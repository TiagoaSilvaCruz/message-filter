import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const localDirectory = path.join(process.cwd(), ".local");
const profileDirectory = path.join(localDirectory, "whatsapp-session");
const groupsPath = path.join(localDirectory, "whatsapp-groups.json");
const tokenPath = path.join(localDirectory, "whatsapp-ingest-token");
const apiUrl = "http://127.0.0.1:3000/api/whatsapp/messages";
const defaultConfig = { groups: [], pollIntervalSeconds: 60 };

async function getOrCreateToken() {
  await mkdir(localDirectory, { recursive: true, mode: 0o700 });
  try {
    return (await readFile(tokenPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const token = randomBytes(32).toString("hex");
  try {
    await writeFile(tokenPath, `${token}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return token;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
    return (await readFile(tokenPath, "utf8")).trim();
  }
}

async function loadConfig() {
  try {
    const config = JSON.parse(await readFile(groupsPath, "utf8"));
    if (
      !Array.isArray(config.groups) ||
      !config.groups.every((group) => typeof group === "string" && group.trim()) ||
      (config.pollIntervalSeconds !== undefined &&
        (!Number.isInteger(config.pollIntervalSeconds) || config.pollIntervalSeconds < 30))
    ) {
      throw new Error("A configuração precisa de uma lista de grupos e intervalo de pelo menos 30 segundos.");
    }
    if (config.groups.length === 0) {
      throw new Error(`Adicione os nomes exatos dos grupos em ${groupsPath} e execute o leitor novamente.`);
    }
    return {
      groups: [...new Set(config.groups.map((group) => group.trim()))],
      pollIntervalSeconds: config.pollIntervalSeconds ?? defaultConfig.pollIntervalSeconds,
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await mkdir(localDirectory, { recursive: true, mode: 0o700 });
    await writeFile(groupsPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    throw new Error(`Criei ${groupsPath}. Adicione os nomes exatos dos grupos e execute o leitor novamente.`);
  }
}

async function openGroup(page, groupName) {
  const searchSelectors = [
    '#side [contenteditable="true"]:visible',
    '#side [role="textbox"]:visible',
    '#side input:visible',
  ];
  let search;

  for (const selector of searchSelectors) {
    const candidate = page.locator(selector).first();
    if (await candidate.isVisible().catch(() => false)) {
      search = candidate;
      break;
    }
  }

  if (!search) {
    const searchButton = page
      .getByRole("button", { name: /pesquisar|search/i })
      .first();
    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click();
    }

    for (let attempt = 0; attempt < 20 && !search; attempt += 1) {
      for (const selector of searchSelectors) {
        const candidate = page.locator(selector).first();
        if (await candidate.isVisible().catch(() => false)) {
          search = candidate;
          break;
        }
      }
      if (!search) {
        await page.waitForTimeout(250);
      }
    }
  }

  if (!search) {
    const controls = await page.locator("#side button, #side input, #side [role], #side [contenteditable]").evaluateAll(
      (elements) =>
        elements
          .filter((element) => {
            const style = window.getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .slice(0, 20)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            role: element.getAttribute("role"),
            label: element.getAttribute("aria-label"),
            title: element.getAttribute("title"),
            placeholder: element.getAttribute("placeholder"),
          })),
    );
    throw new Error(
      `Não encontrei a busca do WhatsApp Web. Controles visíveis na barra lateral: ${JSON.stringify(controls)}`,
    );
  }

  await search.fill(groupName);

  const result = page.getByTitle(groupName, { exact: true }).first();
  await result.waitFor({ state: "visible", timeout: 15_000 });
  await result.click();
  await page.locator("#main").waitFor({ state: "visible", timeout: 15_000 });
}

async function readCurrentMessages(page) {
  return page.locator("#main [data-pre-plain-text]").evaluateAll((elements) =>
    elements.map((element) => ({
      header: element.getAttribute("data-pre-plain-text") ?? "",
      text: element.innerText ?? "",
    })),
  );
}

async function collectGroup(page, groupName, token) {
  await openGroup(page, groupName);
  const messages = await readCurrentMessages(page);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ groupName, messages }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? `A API local respondeu com HTTP ${response.status}.`);
  }

  console.log(
    `${groupName}: ${result.added} novas mensagens salvas (${result.received} lidas nesta consulta).`,
  );
}

const config = await loadConfig();
const token = await getOrCreateToken();
const context = await chromium.launchPersistentContext(profileDirectory, {
  headless: false,
});
const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto("https://web.whatsapp.com");
  console.log("WhatsApp Web aberto. Se solicitado, leia o QR Code com seu celular.");
  console.log("Aguardando a lista de conversas aparecer...");
  await page.locator("#side").waitFor({ state: "visible", timeout: 5 * 60_000 });
  console.log(`Coletando ${config.groups.length} grupo(s) a cada ${config.pollIntervalSeconds}s.`);

  while (true) {
    for (const groupName of config.groups) {
      try {
        await collectGroup(page, groupName, token);
      } catch (error) {
        console.error(
          `Falha ao ler "${groupName}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalSeconds * 1000));
  }
} finally {
  await context.close();
}

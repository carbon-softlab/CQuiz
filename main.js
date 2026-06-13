/**
 * CQuiz - Continuous Learning Material Quiz Engine for Obsidian
 * Version: 1.0.0
 * Author: carbon-softlab
 * Link: https://github.com/carbon-softlab/CQuiz
 */
"use strict";

const obsidian = require('obsidian');

const DEFAULT_PLUGIN_SETTINGS = {
    history: [],      
    setTypeData: { Hard: [], Medium: [], Easy: [], Hint: [] }, 
    customTags: ["Hard", "Medium", "Easy", "Hint"],
    repetitionData: {}, 
    version: "5.0.0",
    defaultLanguage: "en",
    enableDebug: false,
    resultFolder: "CQuiz-Results"
};

const DEFAULT_QUIZ_CONFIG = {
    mode: "quiz",       
    name: "Custom Exam",
    show: "",           
    sources: [],
    folderSources: [],
    setType: [],        
    filter: "all",      
    startFrom: 1,       
    endTo: 0,           
    timer: true,        
    duration: 0,        
    markPerQ: 1,
    penalty: 0,
    passMark: 10,       
    formula: "({correct} * @markPerQ) - ({wrong} * @penalty)", 
    allowTags: true,    
    shuffle: false,     
    limit: 0,
    repetition: 0,      
    fontSize: "",
    pauseButton: false,
    strict: false,
    renderStyle: "scroll"
};

const TAG_COLOR_PALETTE = {
    Hard:   { bg: "#e74c3c", border: "#c0392b", text: "#ffffff", dot: "#c0392b", activeBg: "#c0392b" },
    Medium: { bg: "#f39c12", border: "#d68910", text: "#ffffff", dot: "#d68910", activeBg: "#d68910" },
    Easy:   { bg: "#27ae60", border: "#1e8449", text: "#ffffff", dot: "#1e8449", activeBg: "#1e8449" },
    Hint:   { bg: "#3498db", border: "#1a6b9a", text: "#ffffff", dot: "#1a6b9a", activeBg: "#1a6b9a" },
};

const AUTO_TAG_COLORS = [
    { bg: "#8e44ad", border: "#6c3483", text: "#ffffff", dot: "#6c3483", activeBg: "#6c3483" },
    { bg: "#16a085", border: "#0e6655", text: "#ffffff", dot: "#0e6655", activeBg: "#0e6655" },
    { bg: "#d35400", border: "#a04000", text: "#ffffff", dot: "#a04000", activeBg: "#a04000" },
    { bg: "#2c3e50", border: "#1a252f", text: "#ffffff", dot: "#1a252f", activeBg: "#1a252f" },
    { bg: "#c0392b", border: "#96281b", text: "#ffffff", dot: "#96281b", activeBg: "#96281b" },
    { bg: "#1abc9c", border: "#148f77", text: "#ffffff", dot: "#148f77", activeBg: "#148f77" },
];
let _autoColorIdx = 0;
const _tagColorCache = {};
function getTagColor(tagName) {
    if (TAG_COLOR_PALETTE[tagName]) return TAG_COLOR_PALETTE[tagName];
    if (!_tagColorCache[tagName]) {
        _tagColorCache[tagName] = AUTO_TAG_COLORS[_autoColorIdx % AUTO_TAG_COLORS.length];
        _autoColorIdx++;
    }
    return _tagColorCache[tagName];
}

class MathEngine {
    static evaluate(formulaStr, variables) {
        let f = formulaStr;
        for (const [key, value] of Object.entries(variables)) {
            f = f.replace(new RegExp(`{${key}}`, 'g'), value);
            f = f.replace(new RegExp(`@${key}`, 'g'), value);
        }
        const IF = (condition, trueResult, falseResult) => condition ? trueResult : falseResult;
        const pow = Math.pow;
        const sqrt = Math.sqrt;
        const nroot = (x, n) => Math.pow(x, 1/n);
        const mod = (a, b) => a % b;

        try {
            const evaluator = new Function('IF', 'pow', 'sqrt', 'nroot', 'mod', `"use strict"; return Number(${f});`);
            const result = evaluator(IF, pow, sqrt, nroot, mod);
            return isNaN(result) ? 0 : Number(result.toFixed(2));
        } catch (error) {
            console.error("CQuiz Engine: Formula Parsing Error.", error);
            return 0; 
        }
    }
}

class DOMUtils {
    static safeText(parent, tag, text, className = "") {
        const el = parent.createEl(tag);
        if (className) el.className = className;
        el.textContent = text; 
        return el;
    }
    
    static async renderMarkdown(text, parent, sourcePath, component, className = "") {
        const el = parent.createDiv();
        if (className) el.className = className;
        await obsidian.MarkdownRenderer.renderMarkdown(text, el, sourcePath, component);
        return el;
    }
}

const SVG_ICONS = {
    brain:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4C8.5 4 6 6.5 6 9c0 1.5.7 2.8 1.8 3.7C6.7 13.6 6 15 6 16.5c0 2 1.5 3.5 3.5 3.5h5c2 0 3.5-1.5 3.5-3.5 0-1.5-.7-2.9-1.8-3.8C17.3 11.8 18 10.5 18 9c0-2.5-2.5-5-6-5z"/><line x1="12" y1="4" x2="12" y2="20"/><path d="M9 9h6M9 14h6"/></svg>`,
    check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    close:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    clock:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    target:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    trophy:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5h12v5a6 6 0 0 1-12 0z"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>`,
    lightning:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    eye:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    refresh:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    chart:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    book:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    copy:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    star:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    zap:      `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    correct:  `<svg viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
    wrong:    `<svg viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    skip:     `<svg viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    image:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    expand:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    note:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
};

function createSVGIcon(name, size = 16) {
    const span = document.createElement("span");
    span.className = "cq-svg-icon";
    span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex-shrink:0;`;
    span.innerHTML = SVG_ICONS[name] || "";
    return span;
}

function createFullscreenBtn(container) {
    const btn = document.createElement("button");
    btn.className = "cq-fullscreen-btn";
    btn.title = "Toggle fullscreen";

    const EXPAND_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    const COLLAPSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`;

    const updateIcon = () => {
        btn.innerHTML = `<span class="cq-svg-icon" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;">${container.classList.contains('cq-is-fullscreen') ? COLLAPSE_SVG : EXPAND_SVG}</span>`;
    };

    btn.onclick = () => {
        const isFs = container.classList.toggle('cq-is-fullscreen');
        document.body.classList.toggle('cq-body-fullscreen', isFs);
        updateIcon();
    };

    updateIcon();
    return btn;
}

class CQuizPlugin extends obsidian.Plugin {
    async onload() {
        console.log("Loading CQuiz - CLM Engine v5.0.0...");
        
        this.settings = Object.assign({}, DEFAULT_PLUGIN_SETTINGS, await this.loadData());
        
        if (!this.settings.setTypeData) this.settings.setTypeData = { Hard: [], Medium: [], Easy: [], Hint: [] };
        if (!this.settings.repetitionData) this.settings.repetitionData = {};
        if (!this.settings.customTags) this.settings.customTags = ["Hard", "Medium", "Easy", "Hint"];
        
        this.settings.customTags.forEach(tag => {
            if (!this.settings.setTypeData[tag]) this.settings.setTypeData[tag] = [];
        });
        
        this.activeSessions = new Map();
        this.lockedFilePath = null;

        this.addSettingTab(new CQuizSettingTab(this.app, this));
        this.injectStyles();

        this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
            if (this.lockedFilePath) {
                const currentFile = this.app.workspace.getActiveFile();
                if (currentFile && currentFile.path !== this.lockedFilePath) {
                    new obsidian.Notice("⚠️ Strict Exam Active! You cannot leave this note until you pause or submit.", 4000);
                    const targetLeaves = this.app.workspace.getLeavesOfType("markdown");
                    const targetLeaf = targetLeaves.find(l => l.view.file && l.view.file.path === this.lockedFilePath);
                    if (targetLeaf) {
                        this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
                    }
                }
            }
        }));

        this.registerMarkdownCodeBlockProcessor("cquiz", async (source, el, ctx) => {
            el.empty(); 
            const container = el.createDiv({ cls: "cq-app-container" });
            
            try {
                const config = this.parseCodeBlock(source);
                if (config.fontSize) container.style.fontSize = config.fontSize;
                
                if (config.mode.toLowerCase() === "stats") {
                    this.renderStatsDashboard(container, ctx);
                } else {
                    const sessionKey = `${ctx.sourcePath}_${config.name}`;
                    if (this.activeSessions.has(sessionKey)) {
                        this.renderQuizUI(container, this.activeSessions.get(sessionKey), ctx);
                    } else {
                        await this.loadAndStartQuiz(container, config, ctx);
                    }
                }
            } catch (error) {
                console.error("CQuiz Fatal Error:", error);
                const errBox = container.createDiv({ cls: "cq-error-box" });
                const icon = createSVGIcon('wrong', 18);
                errBox.appendChild(icon);
                errBox.createSpan({ text: " CQuiz Error: Failed to render block. Check console." });
            }
        });
    }

    async onunload() {
        const styleEl = document.getElementById("cq-plugin-styles");
        if (styleEl) styleEl.remove();
        console.log("CQuiz Engine Unloaded.");
    }

    parseCodeBlock(source) {
        const config = Object.assign({}, DEFAULT_QUIZ_CONFIG);
        const lines = source.split('\n');
        
        lines.forEach(line => {
            if (!line.trim() || line.trim().startsWith("#")) return;
            const equalIndex = line.indexOf('=');
            if (equalIndex === -1) return;

            let key = line.substring(0, equalIndex).trim();
            let value = line.substring(equalIndex + 1).trim();

            if (key.startsWith("@")) {
                const rawKeyName = key.substring(1);
                const actualKey = Object.keys(config).find(k => k.toLowerCase() === rawKeyName.toLowerCase()) || rawKeyName;
                const apiNameLower = actualKey.toLowerCase();
                
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length - 1);
                }

                if (value.toLowerCase() === "true") value = true;
                else if (value.toLowerCase() === "false") value = false;
                
                switch(apiNameLower) {
                    case "set": config.sources = this.extractArgs(value); break;
                    case "setall": config.folderSources = this.extractArgs(value); break;
                    case "settype": config.setType = value.split(',').map(s => s.trim().toLowerCase()); break;
                    case "startfrom": config.startFrom = Math.max(1, parseInt(value) || 1); break;
                    case "endto": config.endTo = Math.max(0, parseInt(value) || 0); break;
                    case "repetition": config.repetition = Math.min(Math.max(parseInt(value) || 0, 0), 10); break; 
                    case "random": config.shuffle = (value === true || String(value).toLowerCase() === "true"); break; 
                    case "onlyread": config.filter = value ? "onlyread" : "all"; break;
                    case "duration": config.duration = this.parseTimeValue(value); break;
                    case "show": config.show = value; break;
                    case "name": config.name = value; break;
                    case "formula": config.formula = value; break;
                    case "fontsize": config.fontSize = value; break;
                    case "pausebutton": config.pauseButton = (value === true || String(value).toLowerCase() === "true"); break;
                    case "strict": config.strict = (value === true || String(value).toLowerCase() === "true"); break;
                    case "renderstyle": config.renderStyle = String(value).toLowerCase() === "paged" ? "paged" : "scroll"; break;
                    default:
                        if (typeof value === "string" && !isNaN(value) && value !== "") {
                            config[actualKey] = parseFloat(value);
                        } else {
                            config[actualKey] = value;
                        }
                }
            }
        });
        return config;
    }

    extractArgs(str) {
        const match = str.match(/\(([^)]+)\)/);
        return match ? match[1].split(',').map(s => s.trim().replace(/['"]/g, "")) : [];
    }

    parseTimeValue(str) {
        str = String(str).toLowerCase().trim();
        if (str.endsWith('h')) return parseFloat(str) * 3600;
        if (str.endsWith('m')) return parseFloat(str) * 60;
        if (str.endsWith('s')) return parseFloat(str);
        return parseFloat(str) || 0;
    }

    async loadAndStartQuiz(container, config, ctx) {
        let questions = await this.fetchQuestions(container, config, ctx);
        if (!questions) return;
        this.renderStartUI(container, questions, config, ctx);
    }

    async fetchQuestions(container, config, ctx) {
        let questions = [];
        const targetRefs = new Set();
        const useTypeFilter = config.setType && config.setType.length > 0;

        if (useTypeFilter) {
            config.setType.forEach(typeKey => {
                const exactMatch = this.settings.customTags.find(t => t.toLowerCase() === typeKey.toLowerCase());
                if (exactMatch) {
                    const pool = this.settings.setTypeData[exactMatch] || [];
                    pool.forEach(ref => {
                        const path = ref.path || ref.mdname;
                        const id = ref.id || ref.qText;
                        if (path && id) targetRefs.add(`${path}::${id}`);
                    });
                }
            });
        }

        let filesToRead = new Set();
        const specificSources = config.sources.length > 0 || config.folderSources.length > 0;

        try {
            if (specificSources) {
                for (const path of config.sources) {
                    const file = this.app.metadataCache.getFirstLinkpathDest(path, ctx.sourcePath);
                    if (file instanceof obsidian.TFile) filesToRead.add(file);
                }
                for (const folderPath of config.folderSources) {
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (folder instanceof obsidian.TFolder) {
                        obsidian.Vault.recurseChildren(folder, (file) => {
                            if (file instanceof obsidian.TFile && file.extension === "md") filesToRead.add(file);
                        });
                    }
                }
            } else if (useTypeFilter) {
                for (const ref of targetRefs) {
                    const path = ref.split("::")[0];
                    const file = this.app.metadataCache.getFirstLinkpathDest(path, "");
                    if (file instanceof obsidian.TFile) filesToRead.add(file);
                }
            }

            for (const file of filesToRead) {
                const raw = await this.app.vault.read(file);
                const parsed = this.parseQuestions(raw, config.filter, file.path);
                questions.push(...parsed);
            }

            if (useTypeFilter) {
                questions = questions.filter(q => targetRefs.has(`${q.path}::${q.id}`));
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            DOMUtils.safeText(container, "div", "⚠️ Error loading file sources.", "cq-error-box");
            return null;
        }

        if (config.startFrom > 1 || config.endTo > 0) {
            const startIndex = Math.max(0, config.startFrom - 1);
            const endIndex = config.endTo > 0 ? config.endTo : questions.length;
            questions = questions.slice(startIndex, endIndex);
        }

        questions.forEach(q => {
            q.tags = this.settings.customTags.filter(t => 
                (this.settings.setTypeData[t] || []).some(saved => 
                    (saved.path || saved.mdname) === q.path && (saved.id || saved.qText) === q.id
                )
            );
        });

        if (config.repetition > 0) {
            const now = Date.now();
            questions.forEach(q => {
                const qId = q.path + "::" + q.id;
                const rep = this.settings.repetitionData[qId] || { correct: 0, total: 0, nextReview: now, interval: 0, ease: 2.5, streak: 0 };
                const mastery = rep.total > 0 ? (rep.correct / rep.total) : 0;
                const isOverdue = now >= (rep.nextReview || 0);
                const overdueRatio = isOverdue ? Math.min((now - rep.nextReview) / 86400000, 30) : 0;

                const newBonus = rep.total === 0 ? 5 : 0;
                q._repScore = (isOverdue ? (8 + overdueRatio) : 0) + ((1 - mastery) * config.repetition * 2) + newBonus + (Math.random() * 0.3);
            });
            questions.sort((a, b) => b._repScore - a._repScore);
        } else if (config.shuffle) {
            questions.sort(() => Math.random() - 0.5);
        }

        if (config.limit > 0) questions = questions.slice(0, parseInt(config.limit));

        if (questions.length === 0) {
            const emptyEl = container.createDiv({ cls: "cq-empty-state" });
            emptyEl.appendChild(createSVGIcon('book', 40));
            emptyEl.createEl('p', { text: "📭 No questions found in the specified range or source." });
            return null;
        }
        return questions;
    }

    parseQuestions(text, filter, path = "Unknown") {
        const lines = text.split('\n');
        const questions = [];
        let currentQ = null;
        let state = "NONE"; 

        lines.forEach(line => {
            const qMatch = line.match(/^(\d+)\.\s+\[([xX\s]?)\]\s+(.*)/);

            const oMatch = line.match(/^\s+(\d+)\.\s+\[([xX\s]?)\]\s+(.*)/) || 
                           line.match(/^\s+[-*]\s+\[([xX\s]?)\]\s+(.*)/);
            const noteMatch = line.match(/^>\s*\[!NOTE\](.*)/i) || line.match(/^>(.*)/);

            if (qMatch && !line.startsWith(" ")) {
                const isRead = qMatch[2].toLowerCase() === 'x';
                if (filter === "onlyread" && !isRead) return;
                if (filter === "unread" && isRead) return;

                currentQ = { 
                    path: path, 
                    id: line.trim(), 
                    questionStr: qMatch[3].trim(), 
                    options: [], 
                    note: "",
                    selected: [], 
                    tags: [],
                    serialNum: questions.length + 1,
                };
                questions.push(currentQ);
                state = "Q";
            } else if (oMatch && currentQ) {

                let optText, optCorrect;
                if (oMatch[3] !== undefined) {

                    optCorrect = oMatch[2].toLowerCase() === 'x';
                    optText = oMatch[3].trim();
                } else {

                    optCorrect = oMatch[1].toLowerCase() === 'x';
                    optText = oMatch[2].trim();
                }
                currentQ.options.push({ text: optText, isCorrect: optCorrect });
                state = "OPT";
            } else if (noteMatch && currentQ && (state === "OPT" || state === "NOTE")) {
                currentQ.note += line + "\n";
                state = "NOTE";
            } else if (currentQ && state === "Q") {
                currentQ.questionStr += "\n" + line; 
            } else if (currentQ && state === "OPT" && !noteMatch && line.trim() !== "") {
                if (currentQ.options.length > 0) {
                    currentQ.options[currentQ.options.length - 1].text += "\n" + line; 
                }
            }
        });
        return questions.filter(q => q.options.length > 0 || q.questionStr !== "");
    }

    createCopyButton(parent, q) {
        const btn = parent.createEl("button", { cls: "cq-copy-btn", title: "Copy Raw Question Format" });
        btn.appendChild(createSVGIcon('copy', 13));
        btn.createSpan({ text: " Copy" });
        btn.onclick = async () => {
            let md = `1. [ ] ${q.questionStr}\n`;
            q.options.forEach((opt, i) => {
                md += `\t${i + 1}. [${opt.isCorrect ? 'x' : ' '}] ${opt.text}\n`;
            });
            if (q.note && q.note.trim() !== "") md += q.note.trim();
            
            try {
                await navigator.clipboard.writeText(md.trim());
                btn.innerHTML = "";
                btn.appendChild(createSVGIcon('check', 13));
                btn.createSpan({ text: " Copied!" });
                btn.classList.add("copied");
                setTimeout(() => {
                    btn.innerHTML = "";
                    btn.appendChild(createSVGIcon('copy', 13));
                    btn.createSpan({ text: " Copy" });
                    btn.classList.remove("copied");
                }, 2000);
            } catch (e) {
                new obsidian.Notice("Failed to copy question.");
            }
        };
        return btn;
    }

    renderStartUI(el, questions, config, ctx) {
        el.empty();
        const startWrap = el.createDiv({ cls: "cq-start-wrap" });
        

        const heroBanner = startWrap.createDiv({ cls: "cq-hero-banner" });
        heroBanner.innerHTML = `
        <svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:var(--cq-accent);stop-opacity:0.15"/>
              <stop offset="100%" style="stop-color:#8e44ad;stop-opacity:0.1"/>
            </linearGradient>
          </defs>
          <rect width="600" height="120" rx="16" fill="url(#heroGrad)" stroke="var(--cq-accent)" stroke-opacity="0.2" stroke-width="1.5"/>
          <!-- Book circles decoration -->
          <circle cx="30" cy="30" r="18" fill="var(--cq-accent)" opacity="0.08"/>
          <circle cx="570" cy="90" r="24" fill="#8e44ad" opacity="0.08"/>
          <circle cx="560" cy="25" r="10" fill="var(--cq-accent)" opacity="0.12"/>
          <circle cx="40" cy="95" r="14" fill="#8e44ad" opacity="0.1"/>
          <!-- Dots pattern -->
          <g opacity="0.15" fill="var(--cq-accent)">
            ${[...Array(8)].map((_, i) => `<circle cx="${80 + i*60}" cy="15" r="2"/>`).join('')}
            ${[...Array(8)].map((_, i) => `<circle cx="${80 + i*60}" cy="105" r="2"/>`).join('')}
          </g>
          <!-- CLM Label -->
          <text x="300" y="55" text-anchor="middle" font-size="11" font-weight="700" fill="var(--cq-accent)" opacity="0.6" letter-spacing="4" font-family="var(--font-text,sans-serif)">CONTINUOUS LEARNING MATERIAL</text>
          <text x="300" y="80" text-anchor="middle" font-size="22" font-weight="800" fill="var(--cq-text)" opacity="0.85" font-family="var(--font-text,sans-serif)">${config.name}</text>
        </svg>`;
        
        if (config.show) {
            const descWrap = startWrap.createDiv({ cls: "cq-start-desc-wrap" });
            descWrap.createEl("p", { text: config.show, cls: "cq-start-desc" });
        }

        const metaGrid = startWrap.createDiv({ cls: "cq-start-meta-grid" });
        
        const metaItems = [
            { icon: 'note',      label: "Questions",  value: questions.length.toString() },
            { icon: 'clock',     label: "Duration",   value: config.duration > 0 ? this.formatTime(config.duration) : "Unlimited" },
            { icon: 'target',    label: "Pass Mark",  value: config.passMark.toString() },
            { icon: 'lightning', label: "Mark/Q",     value: config.markPerQ.toString() },
        ];
        if (config.repetition > 0) metaItems.push({ icon: 'brain', label: "Repetition", value: `${config.repetition}/10` });
        if (config.strict) metaItems.push({ icon: 'eye', label: "Strict Mode", value: "ON" });
        if (config.shuffle) metaItems.push({ icon: 'refresh', label: "Shuffled", value: "Yes" });
        if (config.renderStyle === "paged") metaItems.push({ icon: 'lightning', label: "Mode", value: "Paged" });
        
        metaItems.forEach(item => {
            const card = metaGrid.createDiv({ cls: "cq-start-meta-card" });
            const iconWrap = card.createDiv({ cls: "cq-start-meta-icon" });
            iconWrap.appendChild(createSVGIcon(item.icon, 20));
            card.createDiv({ text: item.value, cls: "cq-start-meta-value" });
            card.createDiv({ text: item.label, cls: "cq-start-meta-label" });
        });

        const btnRow = startWrap.createDiv({ cls: "cq-start-actions" });
        
        const fsBtn = createFullscreenBtn(el.closest('.cq-app-container') || el);
        fsBtn.classList.add('cq-start-fs-btn');
        startWrap.appendChild(fsBtn);
        
        const startBtn = btnRow.createEl("button", { cls: "cq-submit-btn cq-btn-large" });
        startBtn.appendChild(createSVGIcon('lightning', 18));
        startBtn.createSpan({ text: "  Start Quiz" });
        startBtn.onclick = async () => {

            el.empty();
            const loadingScreen = el.createDiv({ cls: "cq-loading-screen" });
            loadingScreen.innerHTML = `<div class="cq-spinner"></div><h3>⚡ Launching Exam…</h3><p>Preparing ${questions.length} question${questions.length !== 1 ? 's' : ''}…</p>`;

            await new Promise(r => setTimeout(r, 30));
            const session = {
                questions, config,
                timeInSeconds: config.duration > 0 ? config.duration : 0,
                isPaused: false, interval: null
            };
            this.renderQuizUI(el, session, ctx);
        };

        const refreshBtn = btnRow.createEl("button", { cls: "cq-secondary-btn" });
        refreshBtn.appendChild(createSVGIcon('refresh', 14));
        refreshBtn.createSpan({ text: "  Refresh" });
        refreshBtn.onclick = async () => {
            const freshQs = await this.fetchQuestions(el.parentElement, config, ctx);
            if (freshQs) this.renderStartUI(el, freshQs, config, ctx);
            new obsidian.Notice("Quiz pool updated.");
        };
    }

    async toggleQuestionType(q, tagName, isAdding) {
        if (!this.settings.setTypeData[tagName]) this.settings.setTypeData[tagName] = [];
        const pool = this.settings.setTypeData[tagName];
        const qId = q.path + "::" + q.id;

        if (isAdding) {
            if (!pool.find(x => ((x.path || x.mdname) + "::" + (x.id || x.qText)) === qId)) {
                pool.push({ path: q.path, id: q.id }); 
            }
        } else {
            this.settings.setTypeData[tagName] = pool.filter(x => ((x.path || x.mdname) + "::" + (x.id || x.qText)) !== qId);
        }
        await this.saveData(this.settings);
    }

    async renderQuizUI(el, session, ctx) {
        el.empty();
        
        const { questions, config } = session;
        const sessionKey = `${ctx.sourcePath}_${config.name}`;
        this.activeSessions.set(sessionKey, session);

        const updateStrictLock = () => {
            if (config.strict && !session.isPaused) this.lockedFilePath = ctx.sourcePath;
            else this.lockedFilePath = null;
        };
        updateStrictLock();
        
        const loadingScreen = el.createDiv({ cls: "cq-loading-screen" });
        loadingScreen.innerHTML = `<div class="cq-spinner"></div><h3>⏳ Preparing Exam…</h3><p>Rendering questions & loading assets…</p>`;

        const mainWrap = el.createDiv({ cls: "cq-quiz-main-wrap" });
        mainWrap.style.display = "none";
        
        const pauseOverlay = mainWrap.createDiv({ cls: "cq-paused-overlay" });
        const pauseContent = pauseOverlay.createDiv({ cls: "cq-pause-content" });
        pauseContent.createEl("h2", { text: "⏸️ Exam Paused" });
        pauseContent.createEl("p", { text: "Timer and visibility are suspended." });
        const pauseResumeBtn = pauseContent.createEl("button", { cls: "cq-submit-btn cq-pause-resume-btn" });
        pauseResumeBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;">▶ Resume Exam</span>`;
        pauseContent.createDiv({ cls: "cq-resume-hint", text: "or double-click anywhere" });
        if (session.isPaused) pauseOverlay.classList.add("active");

        const progressBar = mainWrap.createDiv({ cls: "cq-progress-bar-wrap" });
        const progressInner = progressBar.createDiv({ cls: "cq-progress-bar-inner" });
        const updateProgress = () => {
            const answered = questions.filter(q => q.selected && q.selected.length > 0).length;
            const pct = Math.round((answered / questions.length) * 100);
            progressInner.style.width = pct + "%";
            progressInner.setAttribute('data-pct', pct + "%");
        };

        const stickyHeader = mainWrap.createDiv({ cls: "cq-header-sticky" });
        const headerRow = stickyHeader.createDiv({ cls: "cq-header-row" });
        
        const titleWrap = headerRow.createDiv({ cls: "cq-header-title-wrap" });
        titleWrap.appendChild(createSVGIcon('book', 18));
        titleWrap.createSpan({ text: " " + config.name, cls: "cq-header-title" });

        const headerActions = headerRow.createDiv({ cls: "cq-header-actions" });
        headerActions.appendChild(createFullscreenBtn(el.closest('.cq-app-container') || el));

        let timerDisplay = null;
        
        let pauseBtn;
        if (config.pauseButton) {
            pauseBtn = headerActions.createEl("button", { cls: "cq-secondary-btn cq-pause-btn" });
            
            const handlePauseToggle = () => {
                session.isPaused = !session.isPaused;
                pauseBtn.innerHTML = "";
                pauseBtn.createSpan({ text: session.isPaused ? "▶ Resume" : "⏸ Pause" });
                pauseOverlay.classList.toggle("active", session.isPaused);
                updateStrictLock();
            };

            pauseBtn.createSpan({ text: session.isPaused ? "▶ Resume" : "⏸ Pause" });
            pauseBtn.onclick = handlePauseToggle;
            pauseResumeBtn.onclick = (e) => { e.stopPropagation(); handlePauseToggle(); };
            pauseOverlay.addEventListener('dblclick', (e) => {
                if (e.target === pauseOverlay && session.isPaused) handlePauseToggle();
            });
        }

        if (config.timer || config.duration > 0) {
            timerDisplay = headerActions.createDiv({ cls: "cq-timer" });
            timerDisplay.appendChild(createSVGIcon('clock', 14));
            timerDisplay.createSpan({ cls: "cq-timer-text", text: "00:00" });
        }

        const updateTimerDisplay = () => {
            if (!timerDisplay || !el.isConnected) return;
            const m = Math.floor(session.timeInSeconds / 60).toString().padStart(2, '0');
            const s = (session.timeInSeconds % 60).toString().padStart(2, '0');
            const textSpan = timerDisplay.querySelector('.cq-timer-text');
            if (textSpan) textSpan.textContent = ` ${m}:${s}`;
            if (config.duration > 0 && session.timeInSeconds <= 60) {
                timerDisplay.classList.add('cq-timer-urgent');
            }
        };
        if (config.timer) updateTimerDisplay();

        const scrollArea = mainWrap.createDiv({ cls: "cq-scroll-area" });
        const qContainer = scrollArea.createDiv({ cls: "cq-questions-wrapper" });

        // --- Paged mode state ---
        const isPaged = config.renderStyle === "paged";
        let currentPageIdx = 0;
        let pageNavBar = null;
        let pageCounter = null;
        let pagePrevBtn = null;
        let pageNextBtn = null;
        let pageDotsWrap = null;

        if (isPaged) {
            scrollArea.classList.add("cq-paged-scroll");
        }

        for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const q = questions[qIdx];
            const originalPath = q.path || ctx.sourcePath;

            const qCard = qContainer.createDiv({ cls: "cq-question-card" });
            if (isPaged) {
                qCard.classList.add("cq-page-card");
                if (qIdx !== 0) qCard.style.display = "none";
            }
            

            const cardHeader = qCard.createDiv({ cls: "cq-card-header" });
            

            const serialBadge = cardHeader.createDiv({ cls: "cq-serial-badge" });
            serialBadge.createSpan({ text: `Q`, cls: "cq-serial-q" });
            serialBadge.createSpan({ text: `${qIdx + 1}`, cls: "cq-serial-num" });

            const correctCount = q.options.filter(o => o.isCorrect).length;
            if (correctCount > 1) {
                const multiBadge = cardHeader.createDiv({ cls: "cq-multi-badge" });
                multiBadge.appendChild(createSVGIcon('check', 11));
                multiBadge.createSpan({ text: ` Select ${correctCount}` });
            }
            

            const sourcePath = cardHeader.createDiv({ cls: "cq-card-source" });
            sourcePath.appendChild(createSVGIcon('note', 11));
            sourcePath.createSpan({ text: " " + (q.path || "Unknown").split('/').pop().replace('.md', '') });
            

            const cardBody = qCard.createDiv({ cls: "cq-card-body" });
            const qContentWrap = cardBody.createDiv({ cls: "cq-q-content" });
            await DOMUtils.renderMarkdown(q.questionStr, qContentWrap, originalPath, this);
            

            this.enhanceImages(qContentWrap, originalPath);

            if (config.allowTags) {
                const tagsSection = qCard.createDiv({ cls: "cq-tags-section" });
                const tagsLabel = tagsSection.createSpan({ cls: "cq-tags-label" });
                tagsLabel.appendChild(createSVGIcon('star', 11));
                tagsLabel.createSpan({ text: " Tag:" });
                
                const tagScrollWrap = tagsSection.createDiv({ cls: "cq-tag-scroll-wrap" });
                const tagGroup = tagScrollWrap.createDiv({ cls: "cq-tag-group-horizontal" });
                this.settings.customTags.forEach(tagName => {
                    const colors = getTagColor(tagName);
                    const btn = tagGroup.createEl("button", { text: tagName, cls: "cq-tag-pill" });

                    btn.style.setProperty('--tag-bg', colors.bg);
                    btn.style.setProperty('--tag-border', colors.border);
                    btn.style.setProperty('--tag-text', colors.text);
                    
                    if (q.tags && q.tags.includes(tagName)) btn.classList.add('active');

                    btn.onclick = async () => {
                        const isNowActive = btn.classList.toggle('active');
                        // Brief scale pulse to confirm the action
                        btn.style.transform = 'scale(0.92)';
                        setTimeout(() => { btn.style.transform = ''; }, 120);
                        if (!q.tags) q.tags = [];
                        if (isNowActive) { if (!q.tags.includes(tagName)) q.tags.push(tagName); }
                        else { q.tags = q.tags.filter(t => t !== tagName); }
                        await this.toggleQuestionType(q, tagName, isNowActive);
                        new obsidian.Notice(`${isNowActive ? '✅' : '❌'} ${tagName}: Q${qIdx + 1}`);
                    };
                });
                

                const actionsGroup = tagsSection.createDiv({ cls: "cq-card-actions" });
                this.createCopyButton(actionsGroup, q);
            }

            const isMulti = correctCount > 1;
            const optionsSection = qCard.createDiv({ cls: "cq-options-section" });
            
            if (isMulti) {
                const multiHint = optionsSection.createDiv({ cls: "cq-options-hint" });
                multiHint.appendChild(createSVGIcon('check', 12));
                multiHint.createSpan({ text: ` Multiple correct answers — select all that apply` });
            }
            
            const optionsWrap = optionsSection.createDiv({ cls: "cq-options-wrap" });
            
            const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            
            for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
                const opt = q.options[oIdx];
                const optBtn = optionsWrap.createDiv({ cls: "cq-option" });
                
                const optLetter = optBtn.createDiv({ cls: "cq-option-letter" });
                optLetter.textContent = optionLetters[oIdx] || String(oIdx + 1);
                
                const optContent = optBtn.createDiv({ cls: "cq-option-content" });
                await DOMUtils.renderMarkdown(opt.text, optContent, originalPath, this, "cq-markdown-clean");
                this.enhanceImages(optContent, originalPath);

                if (q.selected && q.selected.includes(oIdx)) {
                    optBtn.classList.add('is-selected');
                }

                optBtn.onclick = () => {
                    if (isMulti) {
                        const idx = q.selected.indexOf(oIdx);
                        if (idx > -1) { q.selected.splice(idx, 1); optBtn.classList.remove('is-selected'); }
                        else { q.selected.push(oIdx); optBtn.classList.add('is-selected'); }
                    } else {
                        optionsWrap.querySelectorAll('.cq-option').forEach(b => b.classList.remove('is-selected'));
                        q.selected = [oIdx];
                        optBtn.classList.add('is-selected');
                    }
                    updateProgress();
                    updateSubmitProgress();

                    qCard.classList.toggle('is-answered', q.selected.length > 0);
                };
            }
        }

        // --- Paged navigation bar ---
        if (isPaged) {
            pageNavBar = scrollArea.createDiv({ cls: "cq-page-nav-bar" });

            pagePrevBtn = pageNavBar.createEl("button", { cls: "cq-page-nav-btn cq-page-prev" });
            pagePrevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><polyline points="15 18 9 12 15 6"/></svg>`;
            pagePrevBtn.title = "Previous (Alt+←)";

            const pageCenterWrap = pageNavBar.createDiv({ cls: "cq-page-nav-center" });
            pageCounter = pageCenterWrap.createDiv({ cls: "cq-page-counter" });

            pageDotsWrap = pageCenterWrap.createDiv({ cls: "cq-page-dots" });
            questions.forEach((_, di) => {
                const dot = pageDotsWrap.createDiv({ cls: "cq-page-dot" + (di === 0 ? " active" : "") });
                dot.title = `Go to Q${di + 1}`;
                dot.onclick = () => goToPage(di);
            });

            pageNextBtn = pageNavBar.createEl("button", { cls: "cq-page-nav-btn cq-page-next" });
            pageNextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><polyline points="9 18 15 12 9 6"/></svg>`;
            pageNextBtn.title = "Next (Alt+→)";

            const updatePageNav = () => {
                const allCards = qContainer.querySelectorAll('.cq-page-card');
                allCards.forEach((c, i) => { c.style.display = i === currentPageIdx ? "" : "none"; });
                pageCounter.textContent = `Question ${currentPageIdx + 1} of ${questions.length}`;
                pagePrevBtn.disabled = currentPageIdx === 0;
                pageNextBtn.disabled = currentPageIdx === questions.length - 1;
                const dots = pageDotsWrap.querySelectorAll('.cq-page-dot');
                dots.forEach((d, i) => d.classList.toggle('active', i === currentPageIdx));
                dots.forEach((d, i) => d.classList.toggle('answered', !!(questions[i].selected && questions[i].selected.length > 0)));
                scrollArea.scrollTop = 0;
            };

            const goToPage = (idx) => {
                if (idx < 0 || idx >= questions.length) return;
                currentPageIdx = idx;
                updatePageNav();
            };

            pagePrevBtn.onclick = () => goToPage(currentPageIdx - 1);
            pageNextBtn.onclick = () => goToPage(currentPageIdx + 1);

            // Keyboard shortcut: Alt+Left / Alt+Right
            const keyHandler = (e) => {
                if (!el.isConnected) { document.removeEventListener('keydown', keyHandler); return; }
                if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); goToPage(currentPageIdx - 1); }
                if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goToPage(currentPageIdx + 1); }
            };
            document.addEventListener('keydown', keyHandler);
            // Remove listener when quiz submits/closes
            session._pagedKeyHandler = keyHandler;

            // Wrap updateProgress to also refresh dots
            const origUpdateProgress = updateProgress;
            const wrappedUpdateProgress = () => { origUpdateProgress(); if (isPaged) updatePageNav(); };
            // Patch optBtn.onclick callbacks to use wrapped version (done via updateProgress being closure)
            // We instead just override updateProgress in the closure:
            qContainer.addEventListener('click', () => { if (isPaged) updatePageNav(); });

            updatePageNav();
        }

        const submitBar = scrollArea.createDiv({ cls: "cq-submit-bar" });
        

        const statsRow = submitBar.createDiv({ cls: "cq-submit-stats-row" });
        
        const totalChip = statsRow.createDiv({ cls: "cq-submit-chip cq-chip-total" });
        totalChip.innerHTML = `<span class="cq-chip-icon">📋</span><span class="cq-chip-label">Total</span><span class="cq-chip-val">${questions.length}</span>`;
        
        const selectedChip = statsRow.createDiv({ cls: "cq-submit-chip cq-chip-selected" });
        
        const skippedChip = statsRow.createDiv({ cls: "cq-submit-chip cq-chip-skipped" });
        skippedChip.title = "Click to see skipped questions";
        skippedChip.style.cursor = "pointer";

        const skippedPanel = submitBar.createDiv({ cls: "cq-skipped-panel" });
        skippedPanel.style.display = "none";
        const skippedPanelTitle = skippedPanel.createDiv({ cls: "cq-skipped-panel-title" });
        skippedPanelTitle.innerHTML = `<span>⚠️ Unanswered Questions — click a number to jump</span>`;
        const skippedNumsWrap = skippedPanel.createDiv({ cls: "cq-skipped-nums-wrap" });

        const updateSubmitProgress = () => {
            const answered = questions.filter(q => q.selected && q.selected.length > 0).length;
            const skipped = questions.length - answered;
            
            selectedChip.innerHTML = `<span class="cq-chip-icon">✅</span><span class="cq-chip-label">Answered</span><span class="cq-chip-val">${answered}</span>`;
            skippedChip.innerHTML = `<span class="cq-chip-icon">⏭️</span><span class="cq-chip-label">Skipped</span><span class="cq-chip-val cq-chip-val-skip${skipped > 0 ? ' has-skipped' : ''}">${skipped}</span>`;

            skippedNumsWrap.empty();
            const skippedQs = questions.map((q, i) => ({ q, i })).filter(({ q }) => !q.selected || q.selected.length === 0);
            if (skippedQs.length === 0) {
                skippedPanel.style.display = "none";
                skippedChip.classList.remove("has-skips");
            } else {
                skippedChip.classList.add("has-skips");
                skippedQs.forEach(({ q, i }) => {
                    const numBtn = skippedNumsWrap.createEl("button", { cls: "cq-skip-num-btn", text: String(i + 1) });
                    numBtn.title = `Jump to Q${i + 1}`;
                    numBtn.onclick = () => {
                        if (isPaged) {
                            // Paged mode: switch to that page
                            currentPageIdx = i;
                            const allCards = qContainer.querySelectorAll('.cq-page-card');
                            allCards.forEach((c, ci) => { c.style.display = ci === i ? "" : "none"; });
                            pageCounter.textContent = `Question ${i + 1} of ${questions.length}`;
                            pagePrevBtn.disabled = i === 0;
                            pageNextBtn.disabled = i === questions.length - 1;
                            const dots = pageDotsWrap.querySelectorAll('.cq-page-dot');
                            dots.forEach((d, di) => d.classList.toggle('active', di === i));
                            scrollArea.scrollTop = 0;
                            // Highlight the card briefly
                            if (allCards[i]) {
                                allCards[i].classList.add('cq-jump-highlight');
                                setTimeout(() => allCards[i].classList.remove('cq-jump-highlight'), 1800);
                            }
                        } else {
                            // Scroll mode: scroll to card
                            const allCards = qContainer.querySelectorAll('.cq-question-card');
                            if (allCards[i]) {
                                allCards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                allCards[i].classList.add('cq-jump-highlight');
                                setTimeout(() => allCards[i].classList.remove('cq-jump-highlight'), 1800);
                            }
                        }
                    };
                });
                if (skippedPanel.style.display !== "none") {

                }
            }
        };

        skippedChip.onclick = () => {
            const skipped = questions.filter(q => !q.selected || q.selected.length === 0).length;
            if (skipped === 0) return;
            const isOpen = skippedPanel.style.display !== "none";
            skippedPanel.style.display = isOpen ? "none" : "block";
            skippedChip.classList.toggle("panel-open", !isOpen);
        };

        updateSubmitProgress();
        
        const submitActionsRow = submitBar.createDiv({ cls: "cq-submit-actions-row" });
        const submitBtn = submitActionsRow.createEl("button", { cls: "cq-submit-btn" });
        submitBtn.appendChild(createSVGIcon('check', 16));
        submitBtn.createSpan({ text: "  Submit Exam" });
        
        submitBtn.onclick = () => {
            const answered = questions.filter(q => q.selected && q.selected.length > 0).length;
            const msg = answered < questions.length 
                ? `You've answered ${answered}/${questions.length} questions. ${questions.length - answered} skipped. Submit anyway?`
                : "Submit exam?";
            if (confirm(msg)) {
                if (session.interval) window.clearInterval(session.interval);
                if (session._pagedKeyHandler) document.removeEventListener('keydown', session._pagedKeyHandler);
                const timeTaken = config.duration > 0 ? (config.duration - session.timeInSeconds) : session.timeInSeconds;
                this.activeSessions.delete(sessionKey);
                this.lockedFilePath = null;
                this.processResults(el, questions, config, timeTaken, ctx);
            }
        };

        const images = mainWrap.querySelectorAll('img');
        if (images.length > 0) {
            loadingScreen.innerHTML = `<div class="cq-spinner"></div><h3>${createSVGIcon('image', 20).outerHTML} Loading ${images.length} Image(s)…</h3><p>Preparing visual assets…</p>`;
            const loadPromises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
            });
            await Promise.race([Promise.all(loadPromises), new Promise(resolve => setTimeout(resolve, 10000))]);
        }

        loadingScreen.remove();
        mainWrap.style.display = "block";
        updateProgress();
        updateSubmitProgress();

        if (config.timer || config.duration > 0) {
            if (session.interval) window.clearInterval(session.interval);
            session.interval = window.setInterval(() => {
                if (!el.isConnected) { window.clearInterval(session.interval); session.interval = null; return; }
                if (session.isPaused) return;
                if (config.duration > 0) {
                    session.timeInSeconds--;
                    if (session.timeInSeconds <= 0) {
                        window.clearInterval(session.interval);
                        if (session._pagedKeyHandler) document.removeEventListener('keydown', session._pagedKeyHandler);
                        this.activeSessions.delete(sessionKey);
                        this.lockedFilePath = null;
                        this.processResults(el, questions, config, config.duration, ctx);
                        return;
                    }
                } else {
                    session.timeInSeconds++;
                }
                updateTimerDisplay();
            }, 1000);
        }
    }

    enhanceImages(container, sourcePath) {
        const imgs = container.querySelectorAll('img');
        imgs.forEach(img => {
            img.classList.add('cq-question-img');
            img.title = "Click to expand";
            img.addEventListener('click', () => {
                const overlay = document.createElement('div');
                overlay.className = 'cq-lightbox-overlay';
                overlay.innerHTML = `
                    <div class="cq-lightbox-inner">
                        <button class="cq-lightbox-close">${createSVGIcon('close', 20).outerHTML}</button>
                        <img src="${img.src}" alt="${img.alt}" class="cq-lightbox-img"/>
                        ${img.alt ? `<div class="cq-lightbox-caption">${img.alt}</div>` : ''}
                    </div>`;
                document.body.appendChild(overlay);
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay || e.target.closest('.cq-lightbox-close')) overlay.remove();
                });
            });

            const wrapper = document.createElement('div');
            wrapper.className = 'cq-img-wrapper';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            const expandIcon = document.createElement('div');
            expandIcon.className = 'cq-img-expand-icon';
            expandIcon.appendChild(createSVGIcon('expand', 14));
            wrapper.appendChild(expandIcon);
        });
    }

    async processResults(el, questions, config, timeTaken, ctx) {
        let correctCount = 0; let wrongCount = 0; let unattempted = 0;

        const qSnapshot = questions.map(q => ({
            questionStr: q.questionStr,
            note: q.note,
            selected: q.selected,
            options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
            rawOriginal: q,
            path: q.path 
        }));

        questions.forEach(q => {
            const qId = q.path + "::" + q.id;
            
            if (!this.settings.repetitionData[qId]) {
                this.settings.repetitionData[qId] = { correct: 0, total: 0, streak: 0, ease: 2.5, interval: 0, nextReview: Date.now() };
            }
            const rep = this.settings.repetitionData[qId];

            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            let isCorrect = false;
            const attempted = q.selected.length > 0;

            if (correctIndices.length === 0) {
                isCorrect = true; 
            } else if (attempted) {
                isCorrect = correctIndices.length === q.selected.length && correctIndices.every(i => q.selected.includes(i));
            }

            if (!attempted && correctIndices.length > 0) {
                unattempted++;

                rep.streak = 0;
                rep.ease = Math.max(1.3, rep.ease - 0.25);
                rep.interval = 1;
            } else {
                rep.total++;
                if (isCorrect) {
                    correctCount++;
                    rep.correct++;
                    rep.streak++;

                    if (rep.streak === 1) rep.interval = 1;
                    else if (rep.streak === 2) rep.interval = 6;
                    else rep.interval = Math.round(rep.interval * rep.ease);
                    rep.ease = Math.min(4.0, rep.ease + 0.1);
                } else {
                    wrongCount++;
                    rep.streak = 0;
                    rep.interval = 1;
                    rep.ease = Math.max(1.3, rep.ease - 0.2);
                }
            }
            rep.nextReview = Date.now() + (rep.interval * 86400000);
        });

        const total = questions.length;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        const answered = correctCount + wrongCount;
        const totalSelected = questions.filter(q => q.selected && q.selected.length > 0).length;

        const variables = { 
            correct: correctCount, wrong: wrongCount, total, totalQ: total,
            skip: unattempted, markPerQ: config.markPerQ || 1, penalty: config.penalty || 0 
        };
        const finalScore = MathEngine.evaluate(config.formula, variables);
        const maxScore = MathEngine.evaluate(config.formula, { correct: total, wrong: 0, total, totalQ: total, skip: 0, markPerQ: config.markPerQ || 1, penalty: 0 });
        const hasPassed = finalScore >= config.passMark;

        const historyEntry = {
            id: Date.now(), exam: config.name, date: new Date().toLocaleString(),
            totalQ: total, answered, totalSelected, correct: correctCount, wrong: wrongCount,
            unattempted, accuracy, score: finalScore, maxScore, passMark: config.passMark,
            passed: hasPassed, time: timeTaken, qData: qSnapshot
        };
        
        this.settings.history.push(historyEntry);
        await this.saveData(this.settings);

        await this.renderResultViews(el, questions, config, timeTaken, finalScore, maxScore, accuracy, correctCount, wrongCount, unattempted, hasPassed, ctx);
    }

    async renderResultViews(el, questions, config, timeTaken, finalScore, maxScore, accuracy, correctCount, wrongCount, unattempted, hasPassed, ctx) {
        el.empty();
        
        const masterContainer = el.createDiv({ cls: "cq-results-master" });
        const scoreView = masterContainer.createDiv({ cls: "cq-results" });
        const reviewView = masterContainer.createDiv({ cls: "cq-review-hidden" });

        const resultHero = scoreView.createDiv({ cls: "cq-result-hero" });
        resultHero.innerHTML = `
        <svg viewBox="0 0 500 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="resultGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:${hasPassed ? '#27ae60' : '#e74c3c'};stop-opacity:0.2"/>
              <stop offset="100%" style="stop-color:${hasPassed ? '#2ecc71' : '#c0392b'};stop-opacity:0.05"/>
            </linearGradient>
          </defs>
          <rect width="500" height="100" rx="12" fill="url(#resultGrad)" stroke="${hasPassed ? '#27ae60' : '#e74c3c'}" stroke-opacity="0.3" stroke-width="1.5"/>
          <text x="250" y="38" text-anchor="middle" font-size="28" fill="${hasPassed ? '#27ae60' : '#e74c3c'}" font-weight="800" font-family="var(--font-text,sans-serif)">${hasPassed ? '🎉 PASSED' : '❌ FAILED'}</text>
          <text x="250" y="68" text-anchor="middle" font-size="13" fill="var(--cq-muted)" font-family="var(--font-text,sans-serif)">${config.name}</text>
          <text x="250" y="88" text-anchor="middle" font-size="11" fill="var(--cq-muted)" opacity="0.7" font-family="var(--font-text,sans-serif)">Score: ${finalScore} / ${maxScore}  ·  Pass Mark: ${config.passMark}</text>
        </svg>`;

        const grid = scoreView.createDiv({ cls: "cq-result-grid" });
        
        const statCards = [
            { label: "Final Score",  value: `${finalScore}/${maxScore}`, icon: 'trophy',   cls: "accent" },
            { label: "Correct",      value: correctCount,                icon: 'correct',  cls: "success" },
            { label: "Wrong",        value: wrongCount,                  icon: 'wrong',    cls: "danger" },
            { label: "Skipped",      value: unattempted,                 icon: 'skip',     cls: "warning" },
            { label: "Accuracy",     value: `${accuracy}%`,             icon: 'target',   cls: "info" },
            { label: "Time Taken",   value: this.formatTime(timeTaken),  icon: 'clock',    cls: "normal" },
            { label: "Answered",     value: `${questions.filter(q=>q.selected&&q.selected.length>0).length}/${questions.length}`, icon: 'check', cls: "normal" },
            { label: "Pass Mark",    value: config.passMark,             icon: 'lightning', cls: "normal" },
        ];
        
        statCards.forEach(sc => {
            const card = grid.createDiv({ cls: `cq-result-stat-card ${sc.cls}` });
            const iconWrap = card.createDiv({ cls: "cq-rsc-icon" });
            iconWrap.appendChild(createSVGIcon(sc.icon, 22));
            card.createDiv({ text: String(sc.value), cls: "cq-rsc-value" });
            card.createDiv({ text: sc.label, cls: "cq-rsc-label" });
        });

        const progressArc = scoreView.createDiv({ cls: "cq-accuracy-arc-wrap" });
        const arcPct = accuracy;
        const arcColor = arcPct >= 80 ? '#27ae60' : arcPct >= 50 ? '#f39c12' : '#e74c3c';
        const r = 42; const circ = 2 * Math.PI * r;
        const offset = circ - (arcPct / 100) * circ;
        progressArc.innerHTML = `
        <svg viewBox="0 0 100 100" width="100" height="100" class="cq-arc-svg">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--cq-border)" stroke-width="8"/>
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="${arcColor}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"
            style="transition: stroke-dashoffset 1s ease;"/>
          <text x="50" y="45" text-anchor="middle" font-size="16" font-weight="800" fill="${arcColor}" font-family="var(--font-text,sans-serif)">${arcPct}%</text>
          <text x="50" y="62" text-anchor="middle" font-size="8" fill="var(--cq-muted)" font-family="var(--font-text,sans-serif)">Accuracy</text>
        </svg>`;

        const actions = scoreView.createDiv({ cls: "cq-result-actions" });
        
        const reviewBtn = actions.createEl("button", { cls: "cq-secondary-btn" });
        reviewBtn.appendChild(createSVGIcon('eye', 14));
        reviewBtn.createSpan({ text: "  Review Answers" });
        reviewBtn.onclick = () => { scoreView.style.display = "none"; reviewView.style.display = "block"; };

        const resetBtn = actions.createEl("button", { cls: "cq-submit-btn" });
        resetBtn.appendChild(createSVGIcon('refresh', 14));
        resetBtn.createSpan({ text: "  Retake Exam" });
        resetBtn.onclick = () => {
            questions.forEach(q => q.selected = []);
            const newSession = { questions, config, timeInSeconds: config.duration > 0 ? config.duration : 0, isPaused: false, interval: null };
            this.renderQuizUI(el, newSession, ctx);
        };

        const exportBtn = actions.createEl("button", { cls: "cq-secondary-btn" });
        exportBtn.appendChild(createSVGIcon('note', 14));
        exportBtn.createSpan({ text: "  Export to Note" });
        exportBtn.onclick = async () => {
            await this.exportResultAsNote(questions, config, timeTaken, finalScore, maxScore, accuracy, correctCount, wrongCount, unattempted, hasPassed);
        };

        const stickyHeader = reviewView.createDiv({ cls: "cq-header-sticky" });
        const reviewHeader = stickyHeader.createDiv({ cls: "cq-header-row" });
        const reviewTitleWrap = reviewHeader.createDiv({ cls: "cq-header-title-wrap" });
        reviewTitleWrap.appendChild(createSVGIcon('eye', 16));
        reviewTitleWrap.createSpan({ text: "  Exam Review", cls: "cq-header-title" });
        
        const reviewHeaderActions = reviewHeader.createDiv({ cls: "cq-header-actions" });
        reviewHeaderActions.appendChild(createFullscreenBtn(el.closest('.cq-app-container') || el));
        
        const backBtn = reviewHeaderActions.createEl("button", { cls: "cq-secondary-btn" });
        backBtn.appendChild(createSVGIcon('refresh', 12));
        backBtn.createSpan({ text: "  Back to Results" });
        backBtn.onclick = () => { reviewView.style.display = "none"; scoreView.style.display = "block"; };

        const reviewScrollArea = reviewView.createDiv({ cls: "cq-scroll-area" });
        await this.renderQuestionsReview(reviewScrollArea, questions, ctx, true);
    }

    async renderQuestionsReview(container, questions, ctx, allowCopy = false) {
        const qContainer = container.createDiv({ cls: "cq-questions-wrapper" });
        const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const q = questions[qIdx];
            const originalPath = q.path || ctx.sourcePath;
            const isAnswered = q.selected && q.selected.length > 0;
            

            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            const isCorrect = isAnswered && correctIndices.length > 0 && correctIndices.length === q.selected.length && correctIndices.every(i => q.selected.includes(i));
            const isPartial = isAnswered && !isCorrect && q.selected.some(i => correctIndices.includes(i));
            
            let cardCls = "cq-question-card";
            let reviewIcon = 'skip';
            let reviewLabel = "Skipped";
            if (isAnswered && isCorrect) { cardCls += " review-correct"; reviewIcon = 'correct'; reviewLabel = "Correct"; }
            else if (isAnswered && !isCorrect) { cardCls += " review-wrong"; reviewIcon = 'wrong'; reviewLabel = isPartial ? "Partial" : "Wrong"; }
            else { cardCls += " review-skipped"; }

            const qCard = qContainer.createDiv({ cls: cardCls });
            

            const cardHeader = qCard.createDiv({ cls: "cq-card-header" });
            const serialBadge = cardHeader.createDiv({ cls: "cq-serial-badge" });
            serialBadge.createSpan({ text: `Q`, cls: "cq-serial-q" });
            serialBadge.createSpan({ text: `${qIdx + 1}`, cls: "cq-serial-num" });
            
            const reviewStatusBadge = cardHeader.createDiv({ cls: `cq-review-status-badge status-${reviewLabel.toLowerCase()}` });
            reviewStatusBadge.appendChild(createSVGIcon(reviewIcon, 13));
            reviewStatusBadge.createSpan({ text: ` ${reviewLabel}` });
            
            if (allowCopy) {
                const actionsWrap = cardHeader.createDiv({ cls: "cq-card-actions" });
                this.createCopyButton(actionsWrap, q.rawOriginal || q);
            }
            

            const cardBody = qCard.createDiv({ cls: "cq-card-body" });
            const qContentWrap = cardBody.createDiv({ cls: "cq-q-content" });
            await DOMUtils.renderMarkdown(q.questionStr, qContentWrap, originalPath, this);
            this.enhanceImages(qContentWrap, originalPath);

            const optionsWrap = qCard.createDiv({ cls: "cq-options-wrap cq-review-options" });
            for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
                const opt = q.options[oIdx];
                const optEl = optionsWrap.createDiv({ cls: "cq-option cq-review-mode" });
                
                const optLetter = optEl.createDiv({ cls: "cq-option-letter" });
                optLetter.textContent = optionLetters[oIdx] || String(oIdx + 1);
                
                const optContent = optEl.createDiv({ cls: "cq-option-content" });
                await DOMUtils.renderMarkdown(opt.text, optContent, originalPath, this, "cq-markdown-clean");
                this.enhanceImages(optContent, originalPath);

                const isSelected = q.selected && q.selected.includes(oIdx);
                const statusIcon = optEl.createDiv({ cls: "cq-option-status-icon" });
                
                if (opt.isCorrect) {
                    optEl.classList.add("is-correct-answer");
                    statusIcon.appendChild(createSVGIcon('correct', 14));
                } else if (isSelected && !opt.isCorrect) {
                    optEl.classList.add("is-wrong-answer");
                    statusIcon.appendChild(createSVGIcon('wrong', 14));
                }
            }

            if (q.note && q.note.trim() !== "") {
                const noteWrap = qCard.createDiv({ cls: "cq-review-note" });
                noteWrap.appendChild(createSVGIcon('note', 14));
                const noteContent = noteWrap.createDiv({ cls: "cq-review-note-content" });
                await DOMUtils.renderMarkdown(q.note, noteContent, originalPath, this);
            }
        }
    }

    async exportResultAsNote(questions, config, timeTaken, finalScore, maxScore, accuracy, correctCount, wrongCount, unattempted, hasPassed) {
        const now = new Date();
        const dateStr = now.toLocaleString();
        const safeExamName = config.name.replace(/[\\/:*?"<>|]/g, '_');
        const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const fileName = `CQuiz Results - ${safeExamName} - ${timestamp}.md`;

        let md = `# 📋 Exam Results: ${config.name}\n\n`;
        md += `> **Date:** ${dateStr}  \n`;
        md += `> **Result:** ${hasPassed ? '✅ PASSED' : '❌ FAILED'}  \n`;
        md += `> **Score:** ${finalScore} / ${maxScore}  \n`;
        md += `> **Pass Mark:** ${config.passMark}  \n\n`;

        md += `## 📊 Summary\n\n`;
        md += `| Metric | Value |\n|--------|-------|\n`;
        md += `| Final Score | ${finalScore} / ${maxScore} |\n`;
        md += `| Correct | ${correctCount} |\n`;
        md += `| Wrong | ${wrongCount} |\n`;
        md += `| Skipped | ${unattempted} |\n`;
        md += `| Accuracy | ${accuracy}% |\n`;
        md += `| Time Taken | ${this.formatTime(timeTaken)} |\n`;
        md += `| Answered | ${correctCount + wrongCount} / ${questions.length} |\n\n`;

        md += `---\n\n## 🗒️ Question Review\n\n`;

        questions.forEach((q, qIdx) => {
            const correctIndices = q.options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
            const isAnswered = q.selected && q.selected.length > 0;
            const isCorrect = isAnswered && correctIndices.length > 0 &&
                correctIndices.length === q.selected.length &&
                correctIndices.every(i => q.selected.includes(i));

            // Status marker: x = answered (any), space = skipped
            const qMark = isAnswered ? 'x' : ' ';
            md += `${qIdx + 1}. [${qMark}] ${q.questionStr}\n`;

            // Tag/difficulty badges
            if (q.tags && q.tags.length > 0) {
                q.tags.forEach(tag => { md += `#${tag.toLowerCase()}\n`; });
            }

            // Status comment line
            let statusLabel = "skipped";
            if (isAnswered && isCorrect) statusLabel = "correct ✅";
            else if (isAnswered && !isCorrect) statusLabel = "wrong ❌";
            md += `	#status-${statusLabel}\n`;

            q.options.forEach((opt, oIdx) => {
                const isSelected = q.selected && q.selected.includes(oIdx);
                const isCorrectOpt = opt.isCorrect;
                // [x] for correct answer, [ ] for incorrect; show user's wrong pick with annotation
                const marker = isCorrectOpt ? 'x' : ' ';
                let line = `\t${oIdx + 1}. [${marker}] ${opt.text}`;
                if (isSelected && !isCorrectOpt) line += ` 	#your-answer`;
                md += line + `\n`;
            });

            if (q.note && q.note.trim()) {
                md += `> [!NOTE] ${q.note.trim()}\n`;
            }
            md += `\n`;
        });

        md += `---\n*Generated by CQuiz on ${dateStr}*\n`;

        try {
            // Resolve folder path from settings (trim slashes for safety)
            const folderPath = (this.settings.resultFolder || "CQuiz-Results").trim().replace(/^\/+|\/+$/g, '');

            // Ensure the folder exists, create it (and any parents) if not
            if (folderPath) {
                const parts = folderPath.split('/');
                let built = '';
                for (const part of parts) {
                    built = built ? `${built}/${part}` : part;
                    if (!this.app.vault.getAbstractFileByPath(built)) {
                        await this.app.vault.createFolder(built);
                    }
                }
            }

            const baseName = `CQuiz Results - ${safeExamName} - ${timestamp}`;
            let finalPath = folderPath ? `${folderPath}/${baseName}.md` : `${baseName}.md`;
            let attempt = 0;
            while (this.app.vault.getAbstractFileByPath(finalPath)) {
                attempt++;
                finalPath = folderPath
                    ? `${folderPath}/${baseName} (${attempt}).md`
                    : `${baseName} (${attempt}).md`;
            }
            await this.app.vault.create(finalPath, md);
            new obsidian.Notice(`✅ Exported to: ${finalPath}`, 5000);
            const createdFile = this.app.vault.getAbstractFileByPath(finalPath);
            if (createdFile) {
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(createdFile);
            }
        } catch (e) {
            console.error("CQuiz Export Error:", e);
            new obsidian.Notice("❌ Export failed. Check console for details.");
        }
    }

    createStatCard(parent, label, value, type = "normal") {
        const card = parent.createDiv({ cls: `cq-stat-card ${type}` });
        DOMUtils.safeText(card, "span", label, "cq-label");
        DOMUtils.safeText(card, "span", String(value), "cq-value");
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    renderStatsDashboard(el, ctx) {
        el.empty();
        const appContainer = el.closest('.cq-app-container') || el;
        const header = el.createDiv({ cls: "cq-dashboard-header" });
        const headerInner = header.createDiv({ cls: "cq-dashboard-header-inner" });
        headerInner.appendChild(createSVGIcon('chart', 22));
        headerInner.createSpan({ text: "  Analytics Dashboard", cls: "cq-dash-title" });
        headerInner.appendChild(createFullscreenBtn(appContainer));

        const tabRow = el.createDiv({ cls: "cq-tab-row" });
        const tabOverview = tabRow.createEl("button", { text: "📊 Overview", cls: "cq-tab-btn active" });
        const tabHistory = tabRow.createEl("button", { text: "📋 History", cls: "cq-tab-btn" });
        
        const contentArea = el.createDiv({ cls: "cq-tab-content" });

        const switchTab = (tab) => {
            tabOverview.classList.remove("active");
            tabHistory.classList.remove("active");
            contentArea.empty();

            if (tab === "overview") {
                tabOverview.classList.add("active");
                if (this.settings.history.length === 0) {
                    DOMUtils.safeText(contentArea, "p", "No exam data found yet.", "cq-empty-state");
                    this.renderCategoryAccess(contentArea, switchTab);
                } else {
                    this.renderDashboardOverview(contentArea, switchTab);
                }
            } else if (tab === "history") {
                tabHistory.classList.add("active");
                if (this.settings.history.length === 0) {
                    DOMUtils.safeText(contentArea, "p", "No exam data found yet.", "cq-empty-state");
                } else {
                    this.renderDashboardHistory(contentArea, el, ctx);
                }
            } else if (tab === "saved") {
                this.renderDashboardCategorized(contentArea, switchTab, ctx);
            }
        };

        tabOverview.onclick = () => switchTab("overview");
        tabHistory.onclick = () => switchTab("history");
        switchTab("overview"); 
    }

    renderDashboardOverview(container, switchTabFn) {
        const history = this.settings.history;
        const totalExams = history.length;
        const passedExams = history.filter(h => h.passed).length;
        const failedExams = totalExams - passedExams;
        const avgAcc = totalExams > 0 ? Math.round(history.reduce((a, b) => a + (b.accuracy || 0), 0) / totalExams) : 0;
        const bestScore = totalExams > 0 ? Math.max(...history.map(h => h.accuracy || 0)) : 0;
        
        const overview = container.createDiv({ cls: "cq-stats-grid" });
        this.createStatCard(overview, "Total Exams", totalExams);
        this.createStatCard(overview, "Passed", passedExams, "success");
        this.createStatCard(overview, "Failed", failedExams, "danger");
        this.createStatCard(overview, "Avg Accuracy", `${avgAcc}%`, "accent");
        this.createStatCard(overview, "Best Score", `${bestScore}%`, "info");

        if (history.length >= 3) {
            const chartWrap = container.createDiv({ cls: "cq-mini-chart-wrap" });
            chartWrap.createEl('h4', { text: "Recent Accuracy Trend", cls: "cq-chart-title" });
            const recent = history.slice(-10);
            const chartSvg = chartWrap.createSVGEl ? chartWrap.createSVGEl("svg") : (() => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); chartWrap.appendChild(s); return s; })();
            const W = 400, H = 60, PAD = 10;
            chartSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
            chartSvg.setAttribute("class", "cq-sparkline");
            chartSvg.style.cssText = "width:100%;height:60px;";
            const maxAcc = 100;
            const barW = (W - PAD * 2) / recent.length - 4;
            recent.forEach((entry, i) => {
                const acc = entry.accuracy || 0;
                const barH = Math.max(4, ((acc / maxAcc) * (H - PAD * 2)));
                const x = PAD + i * ((W - PAD * 2) / recent.length) + 2;
                const y = H - PAD - barH;
                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                rect.setAttribute("x", x); rect.setAttribute("y", y);
                rect.setAttribute("width", barW); rect.setAttribute("height", barH);
                rect.setAttribute("rx", "3");
                rect.setAttribute("fill", acc >= 70 ? "#27ae60" : acc >= 50 ? "#f39c12" : "#e74c3c");
                rect.setAttribute("opacity", "0.8");
                chartSvg.appendChild(rect);
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.setAttribute("x", x + barW/2); label.setAttribute("y", H - 1);
                label.setAttribute("text-anchor","middle"); label.setAttribute("font-size","7");
                label.setAttribute("fill","var(--cq-muted)");
                label.textContent = `${acc}%`;
                chartSvg.appendChild(label);
            });
        }

        this.renderCategoryAccess(container, switchTabFn);
    }

    renderCategoryAccess(container, switchTabFn) {
        const wrap = container.createDiv({ cls: "cq-dashboard-footer" });
        const btn = wrap.createEl("button", { cls: "cq-submit-btn" });
        btn.appendChild(createSVGIcon('star', 14));
        btn.createSpan({ text: "  Manage Tags & Saved Questions" });
        btn.onclick = () => switchTabFn("saved");
    }

    renderDashboardCategorized(container, switchTabFn, ctx) {
        const top = container.createDiv({ cls: "cq-dashboard-toolbar" });
        const back = top.createEl("button", { cls: "cq-secondary-btn" });
        back.appendChild(createSVGIcon('refresh', 12));
        back.createSpan({ text: "  Back to Stats" });
        back.onclick = () => switchTabFn("overview");

        const tagManagerArea = container.createDiv({ cls: "cq-tag-manager-box" });
        tagManagerArea.createEl("h3", { text: "🏷️ Tag Manager" });
        const tagsWrapper = tagManagerArea.createDiv({ cls: "cq-tag-manage-list" });

        let activeType = this.settings.customTags.length > 0 ? this.settings.customTags[0] : null;

        const renderTagManager = () => {
            tagsWrapper.empty();
            this.settings.customTags.forEach(tag => {
                const colors = getTagColor(tag);
                const pill = tagsWrapper.createDiv({ cls: "cq-tag-pill-edit" });
                pill.style.setProperty('--tag-bg', colors.bg);
                pill.style.setProperty('--tag-border', colors.border);

                pill.style.background = colors.bg;
                pill.style.borderColor = colors.border;

                const dot = pill.createDiv({ cls: "cq-tag-dot" });
                dot.style.background = colors.dot;
                pill.createSpan({ text: tag, cls: "cq-tag-name" });

                const count = (this.settings.setTypeData[tag] || []).length;
                pill.createSpan({ text: `(${count})`, cls: "cq-tag-count" });

                const acts = pill.createDiv({ cls: "cq-tag-acts" });
                
                const renBtn = acts.createEl("button", { title: "Rename" });
                renBtn.textContent = "✏️";
                renBtn.onclick = async () => {
                    const newName = prompt(`Rename tag '${tag}' to:`, tag);
                    if (newName && newName.trim() !== "" && newName !== tag) {
                        if (this.settings.customTags.includes(newName.trim())) { new obsidian.Notice("Tag already exists!"); return; }
                        const trimName = newName.trim();
                        const idx = this.settings.customTags.indexOf(tag);
                        this.settings.customTags[idx] = trimName;
                        this.settings.setTypeData[trimName] = this.settings.setTypeData[tag];
                        delete this.settings.setTypeData[tag];
                        await this.saveData(this.settings);
                        if (activeType === tag) activeType = trimName;
                        this.renderDashboardCategorized(container, switchTabFn, ctx);
                    }
                };

                const delBtn = acts.createEl("button", { title: "Delete" });
                delBtn.textContent = "🗑️";
                delBtn.onclick = async () => {
                    if (confirm(`Delete tag '${tag}'? This will remove the label from all questions.`)) {
                        this.settings.customTags = this.settings.customTags.filter(t => t !== tag);
                        delete this.settings.setTypeData[tag];
                        await this.saveData(this.settings);
                        if (activeType === tag) activeType = this.settings.customTags[0] || "";
                        this.renderDashboardCategorized(container, switchTabFn, ctx);
                    }
                };
            });

            const addTagBtn = tagsWrapper.createEl("button", { text: "➕ Add Tag", cls: "cq-add-tag-btn" });
            addTagBtn.onclick = async () => {
                const newTag = prompt("Enter a new custom tag name:");
                if (newTag && newTag.trim() !== "") {
                    const tagStr = newTag.trim();
                    if (!this.settings.customTags.includes(tagStr)) {
                        this.settings.customTags.push(tagStr);
                        this.settings.setTypeData[tagStr] = []; 
                        await this.saveData(this.settings);
                        new obsidian.Notice(`Tag '${tagStr}' added.`);
                        this.renderDashboardCategorized(container, switchTabFn, ctx); 
                    } else {
                        new obsidian.Notice("Tag already exists.");
                    }
                }
            };
        };
        
        renderTagManager();

        if (!activeType) {
            container.createDiv({ cls: "cq-empty-state", text: "No tags yet. Add one above." });
            return;
        }

        const toolbar = container.createDiv({ cls: "cq-dashboard-toolbar" });
        const catButtons = toolbar.createDiv({ cls: "cq-filters" });
        const scrollArea = container.createDiv({ cls: "cq-scroll-area" });
        const typeContainer = scrollArea.createDiv({ cls: "cq-questions-wrapper" }); 
        const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        const renderList = async () => {
            typeContainer.empty();
            if (!activeType) return;

            const listLoader = typeContainer.createDiv({ cls: "cq-loading-screen" });
            listLoader.innerHTML = `<div class="cq-spinner"></div><h3>🏷️ Loading Tagged Questions…</h3><p>Fetching '${activeType}' pool…</p>`;
            await new Promise(r => setTimeout(r, 20));
            listLoader.remove();

            const config = Object.assign({}, DEFAULT_QUIZ_CONFIG, { setType: [activeType], filter: "all" });
            const poolQs = await this.fetchQuestions(typeContainer, config, ctx);

            if (!poolQs || poolQs.length === 0) {
                DOMUtils.safeText(typeContainer, "div", `📭 No questions saved under '${activeType}'.`, "cq-empty-state");
                return;
            }

            for (let idx = 0; idx < poolQs.length; idx++) {
                const q = poolQs[idx];
                const originalPath = q.path || ctx.sourcePath;
                
                const qCard = typeContainer.createDiv({ cls: "cq-question-card" });
                

                const cardHeader = qCard.createDiv({ cls: "cq-card-header" });
                const serialBadge = cardHeader.createDiv({ cls: "cq-serial-badge" });
                serialBadge.createSpan({ text: `Q`, cls: "cq-serial-q" });
                serialBadge.createSpan({ text: `${idx + 1}`, cls: "cq-serial-num" });
                
                const sourcePath = cardHeader.createDiv({ cls: "cq-card-source" });
                sourcePath.appendChild(createSVGIcon('note', 11));
                sourcePath.createSpan({ text: " " + (q.path || "").split('/').pop().replace('.md', '') });
                
                this.createCopyButton(cardHeader, q);
                

                const cardBody = qCard.createDiv({ cls: "cq-card-body" });
                await DOMUtils.renderMarkdown(q.questionStr, cardBody.createDiv({ cls: "cq-q-content" }), originalPath, this);
                

                const tagsSection = qCard.createDiv({ cls: "cq-tags-section" });
                const tagGroup = tagsSection.createDiv({ cls: "cq-tag-group-horizontal" });
                this.settings.customTags.forEach(tagName => {
                    const colors = getTagColor(tagName);
                    const btn = tagGroup.createEl("button", { text: tagName, cls: "cq-tag-pill" });
                    btn.style.setProperty('--tag-bg', colors.bg);
                    btn.style.setProperty('--tag-border', colors.border);
                    btn.style.setProperty('--tag-text', colors.text);
                    if (q.tags && q.tags.includes(tagName)) btn.classList.add('active');
                    btn.onclick = async () => {
                        const isNowActive = btn.classList.toggle('active');
                        await this.toggleQuestionType(q, tagName, isNowActive);
                        if (!isNowActive && tagName === activeType) renderList();
                    };
                });
                

                const optionsWrap = qCard.createDiv({ cls: "cq-options-wrap cq-review-options" });
                for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
                    const opt = q.options[oIdx];
                    const optEl = optionsWrap.createDiv({ cls: "cq-option cq-review-mode" });
                    const optLetter = optEl.createDiv({ cls: "cq-option-letter" });
                    optLetter.textContent = optionLetters[oIdx] || String(oIdx + 1);
                    const optContent = optEl.createDiv({ cls: "cq-option-content" });
                    await DOMUtils.renderMarkdown(opt.text, optContent, originalPath, this, "cq-markdown-clean");
                    if (opt.isCorrect) optEl.classList.add("is-correct-answer");
                }
            }
        };

        this.settings.customTags.forEach(type => {
            const colors = getTagColor(type);
            const btn = catButtons.createEl("button", { text: type, cls: "cq-secondary-btn cq-cat-btn" });
            if (type === activeType) {
                btn.style.borderColor = colors.border;
                btn.style.background = colors.bg;
            }
            btn.onclick = () => { 
                activeType = type; 
                catButtons.querySelectorAll('.cq-cat-btn').forEach(b => { b.style.borderColor = ""; b.style.background = ""; });
                btn.style.borderColor = colors.border;
                btn.style.background = colors.bg;
                renderList(); 
            };
        });

        renderList();
    }

    renderDashboardHistory(container, mainEl, ctx) {
        let searchTerm = "";
        let statusFilter = "all";
        let sortOrder = "newest";

        const toolbar = container.createDiv({ cls: "cq-dashboard-toolbar" });
        const filters = toolbar.createDiv({ cls: "cq-filters" });
        
        const searchInput = filters.createEl("input", { type: "text", placeholder: "🔍 Search exam name…", cls: "cq-search-input" });
        const selectFilter = filters.createEl("select", { cls: "cq-select" });
        selectFilter.add(new Option("All Status", "all"));
        selectFilter.add(new Option("✅ Passed", "pass"));
        selectFilter.add(new Option("❌ Failed", "fail"));
        const sortFilter = filters.createEl("select", { cls: "cq-select" });
        sortFilter.add(new Option("Newest First", "newest"));
        sortFilter.add(new Option("Oldest First", "oldest"));
        sortFilter.add(new Option("Best Score", "best"));
        sortFilter.add(new Option("Worst Score", "worst"));

        const actions = toolbar.createDiv({ cls: "cq-filters" });
        const clearBtn = actions.createEl("button", { cls: "cq-del-all-btn" });
        clearBtn.appendChild(createSVGIcon('wrong', 12));
        clearBtn.createSpan({ text: "  Clear All" });
        clearBtn.onclick = async () => {
            if (confirm("Permanently delete ALL exam records?")) {
                this.settings.history = []; await this.saveData(this.settings);
                this.renderStatsDashboard(mainEl, ctx);
            }
        };

        const tableContainer = container.createDiv({ cls: "cq-table-responsive" });
        
        const renderTable = () => {
            tableContainer.empty();
            const table = tableContainer.createEl("table", { cls: "cq-stats-table" });
            const thead = table.createEl("thead").createEl("tr");
            ["#", "Date", "Exam Name", "Result", "Score / Max", "Correct", "Wrong", "Skip", "Accuracy", "Time", "Action"].forEach(txt => {
                const th = thead.createEl("th");
                th.textContent = txt;
            });
            const tbody = table.createEl("tbody");

            let filteredHistory = this.settings.history.slice().filter(entry => {
                const matchSearch = entry.exam.toLowerCase().includes(searchTerm);
                const matchFilter = statusFilter === "all" || (statusFilter === "pass" && entry.passed) || (statusFilter === "fail" && !entry.passed);
                return matchSearch && matchFilter;
            });

            if (sortOrder === "newest") filteredHistory.reverse();
            else if (sortOrder === "oldest") {  }
            else if (sortOrder === "best") filteredHistory.sort((a, b) => (b.accuracy||0) - (a.accuracy||0));
            else if (sortOrder === "worst") filteredHistory.sort((a, b) => (a.accuracy||0) - (b.accuracy||0));

            if (filteredHistory.length === 0) {
                const tr = tbody.createEl("tr");
                const td = tr.createEl("td");
                td.setAttribute("colspan", "11");
                td.style.cssText = "text-align:center; padding:30px; color:var(--cq-muted);";
                td.textContent = "No records match your filter.";
                return;
            }

            filteredHistory.forEach((entry, idx) => {
                const tr = tbody.createEl("tr");
                

                DOMUtils.safeText(tr, "td", String(idx + 1), "cq-table-serial");
                

                const dateTd = tr.createEl("td", { cls: "cq-table-date" });
                dateTd.textContent = entry.date.split(',')[0];
                

                DOMUtils.safeText(tr, "td", entry.exam, "cq-exam-name");
                

                const statusTd = tr.createEl("td");
                const statusSpan = statusTd.createDiv({ cls: `cq-result-badge-sm ${entry.passed ? 'pass' : 'fail'}` });
                statusSpan.appendChild(createSVGIcon(entry.passed ? 'check' : 'close', 11));
                statusSpan.createSpan({ text: ` ${entry.passed ? 'Pass' : 'Fail'}` });
                if (entry.passMark != null) {
                    statusTd.createSpan({ text: ` (≥${entry.passMark})`, attr: { style: 'font-size:0.8em; color:var(--cq-muted);' } });
                }
                

                const maxScoreDisp = entry.maxScore !== undefined ? entry.maxScore : '?';
                DOMUtils.safeText(tr, "td", `${entry.score} / ${maxScoreDisp}`, "cq-bold");
                

                const correctTd = tr.createEl("td", { cls: "cq-td-correct" });
                correctTd.textContent = entry.correct ?? '-';
                const wrongTd = tr.createEl("td", { cls: "cq-td-wrong" });
                wrongTd.textContent = entry.wrong ?? '-';
                const skipTd = tr.createEl("td", { cls: "cq-td-skip" });
                skipTd.textContent = entry.unattempted ?? (entry.totalQ - (entry.answered || 0)) ?? '-';
                

                const accTd = tr.createEl("td", { cls: "cq-td-accuracy" });
                const acc = entry.accuracy || 0;
                const accColor = acc >= 80 ? '#27ae60' : acc >= 50 ? '#f39c12' : '#e74c3c';
                accTd.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><div style="height:6px;width:50px;background:var(--cq-border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${acc}%;background:${accColor};border-radius:3px;"></div></div><span style="color:${accColor};font-weight:700;">${acc}%</span></div>`;
                

                DOMUtils.safeText(tr, "td", this.formatTime(entry.time || 0));
                

                const tdAction = tr.createEl("td", { cls: "cq-actions-td" });
                
                if (entry.qData && entry.qData.length > 0) {
                    const viewBtn = tdAction.createEl("button", { cls: "cq-icon-btn", title: "View Questions" });
                    viewBtn.appendChild(createSVGIcon('eye', 13));
                    viewBtn.onclick = async () => {

                        container.empty();
                        const loadingScreen = container.createDiv({ cls: "cq-loading-screen" });
                        loadingScreen.innerHTML = `<div class="cq-spinner"></div><h3>📋 Loading Archived Exam…</h3><p>Rendering ${entry.qData.length} question${entry.qData.length !== 1 ? 's' : ''}…</p>`;

                        await new Promise(r => setTimeout(r, 30));
                        loadingScreen.remove();
                        container.createEl("h3", { text: `Archived: ${entry.exam}`, cls: "cq-archived-title" });
                        const reviewScrollArea = container.createDiv({ cls: "cq-scroll-area" });
                        await this.renderQuestionsReview(reviewScrollArea, entry.qData, ctx, false);
                    };

                    const exportHistBtn = tdAction.createEl("button", { cls: "cq-icon-btn", title: "Export to Note" });
                    exportHistBtn.appendChild(createSVGIcon('note', 13));
                    exportHistBtn.onclick = async () => {
                        const fakeConfig = Object.assign({}, DEFAULT_QUIZ_CONFIG, { name: entry.exam, passMark: entry.passMark || 0 });
                        await this.exportResultAsNote(
                            entry.qData, fakeConfig,
                            entry.time || 0, entry.score, entry.maxScore || entry.score,
                            entry.accuracy || 0, entry.correct || 0, entry.wrong || 0,
                            entry.unattempted || 0, entry.passed
                        );
                    };
                }

                const delBtn = tdAction.createEl("button", { cls: "cq-icon-btn cq-del-btn", title: "Delete" });
                delBtn.appendChild(createSVGIcon('wrong', 13));
                delBtn.onclick = async () => {
                    this.settings.history = this.settings.history.filter(h => h.id !== entry.id);
                    await this.saveData(this.settings);
                    renderTable(); 
                };
            });
        };

        searchInput.oninput = (e) => { searchTerm = e.target.value.toLowerCase(); renderTable(); };
        selectFilter.onchange = (e) => { statusFilter = e.target.value; renderTable(); };
        sortFilter.onchange = (e) => { sortOrder = e.target.value; renderTable(); };

        renderTable();
    }

    injectStyles() {
        const styleId = "cq-plugin-styles";
        if (document.getElementById(styleId)) return;

        const styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = `

.cq-app-container {
    --cq-accent: var(--interactive-accent);
    --cq-bg: var(--background-secondary);
    --cq-bg-alt: var(--background-primary);
    --cq-border: var(--divider-color);
    --cq-text: var(--text-normal);
    --cq-muted: var(--text-muted);
    --cq-elevation-1: 0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --cq-elevation-2: 0 8px 16px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.06);
    --cq-elevation-3: 0 16px 32px rgba(0,0,0,0.14);
    --cq-radius: 14px;
    --cq-radius-sm: 8px;
    font-family: var(--font-text), sans-serif;
    color: var(--cq-text);
    margin: 10px 0;
}

.cq-loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; background:var(--cq-bg); border-radius:var(--cq-radius); box-shadow:var(--cq-elevation-1); border:1px solid var(--cq-border); margin:20px 0; }
.cq-spinner { width:44px; height:44px; border:4px solid rgba(var(--interactive-accent-rgb),.2); border-top-color:var(--cq-accent); border-radius:50%; animation:cq-spin 0.9s linear infinite; margin-bottom:20px; }
@keyframes cq-spin { to { transform:rotate(360deg); } }
.cq-loading-screen h3 { margin:0 0 8px; font-size:1.4em; }
.cq-loading-screen p { margin:0; color:var(--cq-muted); }

.cq-svg-icon svg { width:100%; height:100%; display:block; }

.cq-error-box { background:rgba(231,76,60,.1); color:var(--text-error); padding:16px; border-radius:var(--cq-radius-sm); border:1px solid var(--text-error); font-weight:600; display:flex; align-items:center; gap:8px; }
.cq-empty-state { text-align:center; padding:40px 20px; color:var(--cq-muted); font-style:italic; background:var(--cq-bg); border-radius:var(--cq-radius); box-shadow:var(--cq-elevation-1); margin-top:15px; }

.cq-start-wrap { background:linear-gradient(145deg,var(--cq-bg),var(--cq-bg-alt)); border:1px solid var(--cq-border); padding:30px; text-align:center; border-radius:var(--cq-radius); box-shadow:var(--cq-elevation-2); }
.cq-hero-svg { width:100%; height:auto; border-radius:12px; display:block; margin-bottom:20px; }
.cq-start-desc-wrap { margin-bottom:20px; }
.cq-start-desc { font-size:1.05em; color:var(--cq-muted); margin:0; }
.cq-start-meta-grid { display:flex; flex-wrap:wrap; justify-content:center; gap:14px; margin-bottom:28px; }
.cq-start-meta-card { display:flex; flex-direction:column; align-items:center; gap:4px; background:var(--cq-bg-alt); border:1px solid var(--cq-border); border-radius:var(--cq-radius-sm); padding:14px 18px; min-width:80px; box-shadow:var(--cq-elevation-1); transition:transform .2s; }
.cq-start-meta-card:hover { transform:translateY(-2px); }
.cq-start-meta-icon { color:var(--cq-accent); }
.cq-start-meta-value { font-size:1.3em; font-weight:800; color:var(--cq-text); }
.cq-start-meta-label { font-size:0.75em; color:var(--cq-muted); text-transform:uppercase; letter-spacing:.5px; font-weight:600; }
.cq-start-actions { display:flex; justify-content:center; gap:14px; flex-wrap:wrap; }

.cq-progress-bar-wrap { height:6px; background:var(--cq-border); border-radius:3px; overflow:hidden; margin-bottom:16px; position:relative; }
.cq-progress-bar-inner { height:100%; width:0%; background:linear-gradient(90deg,var(--cq-accent),#8e44ad); border-radius:3px; transition:width .4s ease; }

.cq-header-sticky { position:sticky; top:0; background:var(--cq-bg-alt); z-index:20; padding:10px 14px; border-radius:var(--cq-radius-sm); box-shadow:var(--cq-elevation-1); border:1px solid var(--cq-border); margin-bottom:16px; }
.cq-header-row { display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px; flex-wrap:wrap; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.cq-header-title-wrap { display:flex; align-items:center; gap:8px; color:var(--cq-accent); min-width:0; flex-shrink:1; overflow:hidden; }
.cq-header-title { font-size:1.1em; font-weight:700; color:var(--cq-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
.cq-header-actions { display:flex; gap:8px; align-items:center; flex-shrink:0; flex-wrap:nowrap; }
.cq-timer { display:flex; align-items:center; gap:6px; font-family:monospace; font-size:1.15em; font-weight:700; color:var(--cq-accent); background:var(--cq-bg); padding:7px 14px; border-radius:var(--cq-radius-sm); border:1px solid var(--cq-border); }
.cq-timer.cq-timer-urgent { color:#e74c3c; border-color:#e74c3c; animation:cq-pulse .8s infinite; }
@keyframes cq-pulse { 50% { opacity:.7; } }

.cq-scroll-area { max-height:72vh; overflow-y:auto; padding-right:10px; scroll-behavior:smooth; }
.cq-scroll-area::-webkit-scrollbar { width:7px; }
.cq-scroll-area::-webkit-scrollbar-track { background:var(--cq-bg-alt); border-radius:4px; }
.cq-scroll-area::-webkit-scrollbar-thumb { background:var(--cq-muted); border-radius:4px; opacity:.5; }
.cq-scroll-area::-webkit-scrollbar-thumb:hover { background:var(--cq-accent); }

.cq-questions-wrapper { display:flex; flex-direction:column; gap:18px; padding-bottom:20px; }

.cq-question-card {
    background:var(--cq-bg);
    border:1.5px solid var(--cq-border);
    border-radius:var(--cq-radius);
    box-shadow:var(--cq-elevation-1);
    overflow:hidden;
    transition:border-color .2s, box-shadow .2s;
}
.cq-question-card:hover { box-shadow:var(--cq-elevation-2); border-color:rgba(var(--interactive-accent-rgb),.3); }
.cq-question-card.is-answered { border-color:rgba(var(--interactive-accent-rgb),.5); }
.cq-question-card.review-correct { border-color:#27ae60; border-left:4px solid #27ae60; }
.cq-question-card.review-wrong { border-color:#e74c3c; border-left:4px solid #e74c3c; }
.cq-question-card.review-skipped { border-color:#f39c12; border-left:4px solid #f39c12; opacity:.85; }

.cq-card-header {
    display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    padding:12px 16px 10px;
    background:var(--cq-bg-alt);
    border-bottom:1px solid var(--cq-border);
}

.cq-serial-badge {
    display:inline-flex; align-items:baseline; gap:2px;
    background:linear-gradient(135deg,var(--cq-accent),#8e44ad);
    color:white; border-radius:8px; padding:4px 10px;
    font-weight:700; flex-shrink:0; box-shadow:0 2px 6px rgba(var(--interactive-accent-rgb),.3);
}
.cq-serial-q { font-size:0.7em; opacity:.85; letter-spacing:1px; }
.cq-serial-num { font-size:1.1em; }

.cq-multi-badge {
    display:inline-flex; align-items:center; gap:4px;
    background:rgba(52,152,219,.12); border:1px solid rgba(52,152,219,.4);
    color:#2980b9; border-radius:20px; padding:3px 10px;
    font-size:0.78em; font-weight:700;
}

.cq-card-source { display:flex; align-items:center; gap:4px; color:var(--cq-muted); font-size:0.78em; font-family:var(--font-monospace,monospace); margin-left:auto; }

.cq-card-actions { display:flex; align-items:center; gap:8px; margin-left:auto; }

.cq-card-body { padding:16px 18px 12px; }
.cq-q-content p { margin-top:0; margin-bottom:0.5em; }

.cq-img-wrapper { position:relative; display:inline-block; max-width:100%; margin:10px 0; }
.cq-question-img { max-width:100%; height:auto; border-radius:10px; display:block; box-shadow:0 2px 8px rgba(0,0,0,.12); cursor:zoom-in; transition:transform .2s, box-shadow .2s; }
.cq-question-img:hover { transform:scale(1.01); box-shadow:0 4px 14px rgba(0,0,0,.18); }
.cq-img-expand-icon { position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,.55); color:white; border-radius:6px; padding:4px 5px; display:flex; align-items:center; opacity:0; transition:opacity .2s; pointer-events:none; }
.cq-img-wrapper:hover .cq-img-expand-icon { opacity:1; }

.cq-lightbox-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,.85); z-index:9999; display:flex; align-items:center; justify-content:center; animation:cq-fade-in .2s; }
.cq-lightbox-inner { position:relative; max-width:90vw; max-height:90vh; display:flex; flex-direction:column; align-items:center; }
.cq-lightbox-img { max-width:90vw; max-height:80vh; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.5); object-fit:contain; }
.cq-lightbox-caption { margin-top:12px; color:rgba(255,255,255,.7); font-size:.9em; text-align:center; }
.cq-lightbox-close { position:absolute; top:-16px; right:-16px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.2); border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white; transition:.2s; }
.cq-lightbox-close:hover { background:rgba(231,76,60,.8); }

.cq-tags-section {
    display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    padding:10px 18px;
    border-top:1px dashed var(--cq-border);
    border-bottom:1px dashed var(--cq-border);
    background:var(--cq-bg-alt);
}
.cq-tags-label { display:flex; align-items:center; gap:4px; font-size:.78em; color:var(--cq-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px; flex-shrink:0; }
.cq-tag-scroll-wrap { flex:1; overflow-x:auto; overflow-y:hidden; min-width:0; padding-bottom:2px; }
.cq-tag-scroll-wrap::-webkit-scrollbar { height:3px; }
.cq-tag-scroll-wrap::-webkit-scrollbar-track { background:transparent; }
.cq-tag-scroll-wrap::-webkit-scrollbar-thumb { background:var(--cq-border); border-radius:2px; }
.cq-tag-group-horizontal { display:flex; gap:6px; flex-wrap:nowrap; width:max-content; }

.cq-tag-pill {
    border:2px solid var(--tag-border, var(--cq-border));
    background:transparent;
    color:var(--tag-border, var(--cq-muted));
    border-radius:20px; padding:4px 13px;
    font-size:0.8em; font-weight:700; cursor:pointer;
    transition:background .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease, opacity .15s ease;
    white-space:nowrap; flex-shrink:0;
    position:relative; overflow:hidden;
    user-select:none;
}
/* Inactive hover → preview the "will become active" fill */
.cq-tag-pill:not(.active):hover {
    background:var(--tag-bg, rgba(128,128,128,.15));
    color:var(--tag-text, var(--cq-text));
    transform:scale(1.07);
    box-shadow:0 2px 8px rgba(0,0,0,.13);
    opacity:.85;
}
/* Active state → fully filled */
.cq-tag-pill.active {
    background:var(--tag-bg, var(--cq-accent));
    border-color:var(--tag-border, var(--cq-accent));
    color:var(--tag-text, #fff);
    box-shadow:0 3px 10px rgba(0,0,0,.22);
    transform:scale(1.0);
}
/* Active hover → preview "will remove" by dimming */
.cq-tag-pill.active:hover {
    opacity:0.65;
    transform:scale(0.97);
    box-shadow:none;
}

.cq-options-section { padding:14px 18px 18px; }
.cq-options-hint { display:flex; align-items:center; gap:6px; font-size:.82em; color:#2980b9; font-weight:600; margin-bottom:10px; }
.cq-options-wrap { display:flex; flex-direction:column; gap:10px; }

.cq-option {
    display:flex; align-items:flex-start; gap:12px;
    padding:13px 16px; background:var(--cq-bg-alt);
    border:1.5px solid var(--cq-border);
    border-radius:var(--cq-radius-sm); cursor:pointer;
    transition:all .2s ease-out;
    position:relative;
}
.cq-option:hover { background:rgba(var(--interactive-accent-rgb),.05); border-color:var(--cq-accent); transform:translateX(3px); }
.cq-option.is-selected {
    background:linear-gradient(90deg,rgba(var(--interactive-accent-rgb),.12),rgba(var(--interactive-accent-rgb),.03));
    border-color:var(--cq-accent);
    box-shadow:inset 4px 0 0 var(--cq-accent), var(--cq-elevation-1);
    font-weight:600; transform:translateX(5px);
}

.cq-option-letter {
    flex-shrink:0; width:28px; height:28px; border-radius:50%;
    background:var(--cq-border); color:var(--cq-text);
    display:flex; align-items:center; justify-content:center;
    font-weight:700; font-size:.85em; transition:.2s;
}
.cq-option.is-selected .cq-option-letter { background:var(--cq-accent); color:white; }
.cq-option-content { flex:1; min-width:0; }
.cq-option-content p { margin:0; }

.cq-review-options .cq-option { cursor:default; pointer-events:none; }
.cq-option-status-icon { margin-left:auto; flex-shrink:0; }

.is-correct-answer { background:rgba(39,174,96,.1) !important; border-color:#27ae60 !important; }
.is-correct-answer .cq-option-letter { background:#27ae60; color:white; }
.is-wrong-answer { background:rgba(231,76,60,.1) !important; border-color:#e74c3c !important; }
.is-wrong-answer .cq-option-letter { background:#e74c3c; color:white; }

.cq-review-status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:.8em; font-weight:700; }
.cq-review-status-badge.status-correct { background:rgba(39,174,96,.15); color:#27ae60; }
.cq-review-status-badge.status-wrong { background:rgba(231,76,60,.15); color:#e74c3c; }
.cq-review-status-badge.status-skipped { background:rgba(243,156,18,.15); color:#d68910; }
.cq-review-status-badge.status-partial { background:rgba(243,156,18,.15); color:#d68910; }

.cq-review-note { display:flex; gap:10px; align-items:flex-start; margin:12px 18px 16px; padding:14px; background:rgba(var(--interactive-accent-rgb),.07); border-left:4px solid var(--cq-accent); border-radius:6px; }
.cq-review-note-content p { margin:0; }

.cq-submit-bar { display:flex; flex-direction:column; gap:12px; margin-top:16px; padding:16px 18px; background:var(--cq-bg-alt); border-radius:var(--cq-radius); border:1.5px solid var(--cq-border); box-shadow:var(--cq-elevation-1); }

.cq-submit-stats-row { display:flex; gap:10px; flex-wrap:wrap; }
.cq-submit-chip { display:flex; align-items:center; gap:7px; padding:8px 16px; border-radius:20px; font-size:.88em; font-weight:700; border:1.5px solid var(--cq-border); background:var(--cq-bg); flex-shrink:0; transition:all .2s; }
.cq-chip-icon { font-size:1em; }
.cq-chip-label { color:var(--cq-muted); font-weight:600; }
.cq-chip-val { font-size:1.05em; font-weight:800; color:var(--cq-text); }
.cq-chip-total { border-color:rgba(var(--interactive-accent-rgb),.3); }
.cq-chip-total .cq-chip-val { color:var(--cq-accent); }
.cq-chip-selected { border-color:rgba(39,174,96,.35); }
.cq-chip-selected .cq-chip-val { color:#27ae60; }
.cq-chip-skipped { border-color:rgba(243,156,18,.35); user-select:none; }
.cq-chip-skipped .cq-chip-val-skip { color:var(--cq-muted); }
.cq-chip-skipped .cq-chip-val-skip.has-skipped { color:#f39c12; }
.cq-chip-skipped.has-skips { cursor:pointer; }
.cq-chip-skipped.has-skips:hover { background:rgba(243,156,18,.08); transform:translateY(-1px); }
.cq-chip-skipped.panel-open { background:rgba(243,156,18,.12); border-color:#f39c12; }

.cq-skipped-panel { background:rgba(243,156,18,.07); border:1.5px solid rgba(243,156,18,.35); border-radius:var(--cq-radius-sm); padding:12px 14px; animation:cq-card-in .2s ease; }
.cq-skipped-panel-title { font-size:.82em; font-weight:700; color:#d68910; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.cq-skipped-nums-wrap { display:flex; flex-wrap:wrap; gap:7px; }
.cq-skip-num-btn { width:36px; height:36px; border-radius:50%; border:2px solid #f39c12; background:var(--cq-bg-alt); color:#d68910; font-weight:800; font-size:.9em; cursor:pointer; transition:all .18s; display:flex; align-items:center; justify-content:center; }
.cq-skip-num-btn:hover { background:#f39c12; color:white; transform:scale(1.12); box-shadow:0 2px 8px rgba(243,156,18,.4); }

@keyframes cq-jump-flash { 0%,100% { box-shadow:0 0 0 0 rgba(243,156,18,0); } 25% { box-shadow:0 0 0 6px rgba(243,156,18,.5); } 75% { box-shadow:0 0 0 3px rgba(243,156,18,.25); } }
.cq-jump-highlight { animation:cq-jump-flash .6s ease 0s 2; border-color:#f39c12 !important; }

.cq-submit-actions-row { display:flex; justify-content:flex-end; }

.cq-submit-btn { display:inline-flex; align-items:center; background:linear-gradient(135deg,var(--cq-accent),#8e44ad); color:white; padding:11px 24px; border-radius:var(--cq-radius-sm); font-weight:700; cursor:pointer; border:none; font-size:1em; transition:all .2s ease; box-shadow:0 4px 12px rgba(var(--interactive-accent-rgb),.3); }
.cq-submit-btn:hover { opacity:.93; transform:translateY(-2px); box-shadow:0 6px 16px rgba(var(--interactive-accent-rgb),.4); }
.cq-btn-large { font-size:1.15em !important; padding:13px 30px !important; }
.cq-secondary-btn { display:inline-flex; align-items:center; gap:5px; background:var(--cq-bg-alt); border:1px solid var(--cq-border); color:var(--cq-text); padding:10px 18px; border-radius:var(--cq-radius-sm); cursor:pointer; transition:all .2s; font-weight:600; font-size:.95em; }
.cq-secondary-btn:hover { background:var(--background-modifier-hover); box-shadow:var(--cq-elevation-1); transform:translateY(-1px); }
.cq-copy-btn { display:inline-flex; align-items:center; gap:5px; font-size:.8em; padding:5px 12px; background:var(--cq-bg-alt); color:var(--cq-text); border:1px solid var(--cq-border); border-radius:16px; cursor:pointer; transition:.2s; font-weight:600; }
.cq-copy-btn:hover { background:var(--background-modifier-hover); transform:translateY(-1px); }
.cq-copy-btn.copied { background:#27ae60; color:white; border-color:#27ae60; }

.cq-results-master {}
.cq-results { padding:28px; background:var(--cq-bg); border-radius:var(--cq-radius); border:1px solid var(--cq-border); box-shadow:var(--cq-elevation-2); }
.cq-result-hero { margin-bottom:24px; }
.cq-result-svg { width:100%; height:auto; border-radius:12px; }
.cq-result-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin-bottom:20px; }
.cq-result-stat-card { background:var(--cq-bg-alt); border:1.5px solid var(--cq-border); border-radius:var(--cq-radius-sm); padding:16px 14px; display:flex; flex-direction:column; align-items:center; gap:6px; box-shadow:var(--cq-elevation-1); transition:.2s; }
.cq-result-stat-card:hover { transform:translateY(-2px); box-shadow:var(--cq-elevation-2); }
.cq-result-stat-card.accent { border-color:var(--cq-accent); }
.cq-result-stat-card.success .cq-rsc-value { color:#27ae60; }
.cq-result-stat-card.danger .cq-rsc-value { color:#e74c3c; }
.cq-result-stat-card.warning .cq-rsc-value { color:#f39c12; }
.cq-result-stat-card.info .cq-rsc-value { color:#3498db; }
.cq-rsc-icon { color:var(--cq-muted); }
.cq-rsc-value { font-size:1.6em; font-weight:800; }
.cq-rsc-label { font-size:.75em; color:var(--cq-muted); text-transform:uppercase; letter-spacing:.5px; font-weight:700; text-align:center; }
.cq-accuracy-arc-wrap { display:flex; justify-content:center; margin:16px 0; }
.cq-arc-svg {}
.cq-result-actions { display:flex; justify-content:center; gap:14px; margin-top:24px; flex-wrap:wrap; }

.cq-quiz-main-wrap { position:relative; }
.cq-paused-overlay { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(var(--background-primary-rgb),.65); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); z-index:50; display:none; align-items:center; justify-content:center; text-align:center; border-radius:var(--cq-radius); cursor:pointer; }
.cq-paused-overlay.active { display:flex; animation:cq-fade-in .3s forwards; }
.cq-pause-content { padding:40px; background:var(--cq-bg-alt); border-radius:20px; box-shadow:0 24px 48px rgba(0,0,0,.2); border:1px solid rgba(128,128,128,.2); pointer-events:all; }
.cq-paused-overlay { pointer-events:all; }
.cq-pause-content h2 { font-size:2.4em; margin:0 0 10px; background:linear-gradient(90deg,var(--cq-accent),#8e44ad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.cq-pause-content p { font-size:1.15em; color:var(--cq-muted); margin-bottom:20px; }
.cq-resume-hint { display:inline-block; padding:10px 22px; background:rgba(var(--interactive-accent-rgb),.12); color:var(--cq-accent); border-radius:30px; font-weight:700; animation:cq-pulse 2s infinite; }
.cq-pause-resume-btn { margin-top:18px; font-size:1.05em; padding:12px 32px; cursor:pointer; }
@keyframes cq-fade-in { from { opacity:0; } to { opacity:1; } }

.cq-dashboard-header { padding:20px 0 16px; border-bottom:2px solid var(--cq-border); margin-bottom:20px; }
.cq-dashboard-header-inner { display:flex; align-items:center; gap:10px; color:var(--cq-accent); }
.cq-dash-title { font-size:1.5em; font-weight:800; color:var(--cq-text); flex:1; }
.cq-tab-row { display:flex; gap:8px; border-bottom:2px solid var(--cq-border); margin-bottom:20px; }
.cq-tab-btn { background:none; border:none; padding:12px 24px; font-size:1em; font-weight:600; color:var(--cq-muted); cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-2px; transition:.2s; border-radius:8px 8px 0 0; }
.cq-tab-btn:hover { color:var(--cq-text); background:rgba(var(--interactive-accent-rgb),.05); }
.cq-tab-btn.active { color:var(--cq-accent); border-bottom-color:var(--cq-accent); background:linear-gradient(0deg,rgba(var(--interactive-accent-rgb),.08),transparent); }
.cq-dashboard-footer { margin-top:24px; border-top:1px solid var(--cq-border); padding-top:20px; display:flex; justify-content:center; }
.cq-dashboard-toolbar { display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:18px; background:var(--cq-bg); padding:14px 16px; border-radius:var(--cq-radius-sm); border:1px solid var(--cq-border); }
.cq-filters { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.cq-search-input,.cq-select { background:var(--cq-bg-alt); border:1px solid var(--cq-border); padding:9px 13px; border-radius:var(--cq-radius-sm); font-size:.9em; color:var(--cq-text); outline:none; transition:.2s; }
.cq-search-input:focus,.cq-select:focus { border-color:var(--cq-accent); box-shadow:0 0 0 3px rgba(var(--interactive-accent-rgb),.15); }

.cq-stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:14px; margin:20px 0; }
.cq-stat-card { background:var(--cq-bg-alt); padding:22px 16px; border-radius:var(--cq-radius-sm); border:1px solid var(--cq-border); display:flex; flex-direction:column; align-items:center; box-shadow:var(--cq-elevation-1); transition:.2s; }
.cq-stat-card:hover { transform:translateY(-2px); box-shadow:var(--cq-elevation-2); }
.cq-stat-card.accent { border-color:var(--cq-accent); }
.cq-stat-card.success .cq-value { color:#27ae60; }
.cq-stat-card.danger .cq-value { color:#e74c3c; }
.cq-stat-card.info { border-color:#3498db; }
.cq-stat-card.info .cq-value { color:#3498db; }
.cq-label { font-size:.8em; color:var(--cq-muted); text-transform:uppercase; margin-bottom:8px; font-weight:700; letter-spacing:.5px; text-align:center; }
.cq-value { font-size:1.9em; font-weight:800; text-align:center; }

.cq-mini-chart-wrap { background:var(--cq-bg-alt); border:1px solid var(--cq-border); border-radius:var(--cq-radius-sm); padding:16px; margin:16px 0; }
.cq-chart-title { margin:0 0 12px; font-size:1em; color:var(--cq-muted); font-weight:700; }

.cq-tag-manager-box { background:var(--cq-bg-alt); border:1px solid var(--cq-border); padding:18px; border-radius:var(--cq-radius-sm); margin-bottom:18px; }
.cq-tag-manager-box h3 { margin:0 0 14px; font-size:1.1em; }
.cq-tag-manage-list { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.cq-tag-pill-edit { display:flex; align-items:center; gap:6px; background:var(--tag-bg,var(--cq-bg)); border:1.5px solid var(--tag-border,var(--cq-border)); padding:6px 12px; border-radius:20px; font-size:.88em; box-shadow:0 2px 6px rgba(0,0,0,.12); }
.cq-tag-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.cq-tag-name { font-weight:700; color:#fff; }
.cq-tag-count { font-size:.85em; color:var(--cq-muted); }
.cq-tag-acts { display:flex; gap:3px; margin-left:4px; }
.cq-tag-acts button { background:none; border:none; padding:3px 5px; font-size:1em; cursor:pointer; border-radius:4px; opacity:.65; transition:.2s; }
.cq-tag-acts button:hover { opacity:1; background:var(--background-modifier-hover); }
.cq-add-tag-btn { background:var(--cq-accent); color:white; border:none; padding:7px 16px; border-radius:20px; cursor:pointer; font-weight:700; font-size:.88em; transition:.2s; }
.cq-add-tag-btn:hover { filter:brightness(1.1); transform:translateY(-1px); }
.cq-cat-btn { font-size:.88em; padding:7px 16px; }

.cq-table-responsive { overflow-x:auto; border:1px solid var(--cq-border); border-radius:var(--cq-radius-sm); box-shadow:var(--cq-elevation-1); }
.cq-stats-table { width:100%; border-collapse:collapse; font-size:.88em; background:var(--cq-bg-alt); }
.cq-stats-table th,.cq-stats-table td { padding:13px 14px; border-bottom:1px solid var(--cq-border); text-align:left; white-space:nowrap; }
.cq-stats-table th { background:var(--background-secondary); font-weight:700; color:var(--cq-muted); text-transform:uppercase; font-size:.78em; letter-spacing:.5px; position:sticky; top:0; z-index:5; }
.cq-stats-table tr:last-child td { border-bottom:none; }
.cq-stats-table tbody tr:hover td { background:rgba(var(--interactive-accent-rgb),.03); }
.cq-table-serial { color:var(--cq-muted); font-weight:700; font-size:.9em; }
.cq-table-date { color:var(--cq-muted); font-size:.85em; }
.cq-exam-name { font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; }
.cq-bold { font-weight:700; }
.cq-td-correct { color:#27ae60; font-weight:700; }
.cq-td-wrong { color:#e74c3c; font-weight:700; }
.cq-td-skip { color:#f39c12; font-weight:700; }
.cq-td-accuracy {}
.cq-result-badge-sm { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-size:.8em; font-weight:700; }
.cq-result-badge-sm.pass { background:rgba(39,174,96,.15); color:#27ae60; }
.cq-result-badge-sm.fail { background:rgba(231,76,60,.15); color:#e74c3c; }
.cq-actions-td { display:flex; gap:6px; align-items:center; }
.cq-icon-btn { background:var(--cq-bg); border:1px solid var(--cq-border); border-radius:var(--cq-radius-sm); padding:7px 10px; cursor:pointer; transition:.2s; display:flex; align-items:center; }
.cq-icon-btn:hover { background:var(--background-modifier-hover); transform:translateY(-1px); }
.cq-del-btn:hover { background:rgba(231,76,60,.1); border-color:rgba(231,76,60,.3); color:#e74c3c; }
.cq-del-all-btn { display:inline-flex; align-items:center; gap:5px; background:transparent; border:1px solid var(--text-error); color:var(--text-error); padding:9px 16px; border-radius:var(--cq-radius-sm); cursor:pointer; font-weight:700; font-size:.9em; transition:.2s; }
.cq-del-all-btn:hover { background:var(--text-error); color:white; }
.cq-archived-title { margin:16px 0 12px; font-size:1.2em; font-weight:700; color:var(--cq-muted); }

.cq-markdown-clean p { margin:0; }

.cq-question-card { animation:cq-card-in .25s ease forwards; }
@keyframes cq-card-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

.cq-review-hidden { display:none; }

.cq-fullscreen-btn {
    display:inline-flex; align-items:center; justify-content:center;
    width:34px; height:34px; border-radius:var(--cq-radius-sm);
    background:var(--cq-bg); border:1.5px solid var(--cq-border);
    color:var(--cq-muted); cursor:pointer; transition:all .2s;
    flex-shrink:0;
}
.cq-fullscreen-btn:hover { background:rgba(var(--interactive-accent-rgb),.1); color:var(--cq-accent); border-color:var(--cq-accent); transform:scale(1.08); }
.cq-start-fs-btn { position:absolute; top:14px; right:14px; }
.cq-start-wrap { position:relative; }

.cq-is-fullscreen {
    position:fixed !important;
    top:0 !important; left:0 !important;
    width:100vw !important; height:100vh !important;
    z-index:9990 !important;
    overflow-y:auto !important;
    background:var(--background-primary) !important;
    border-radius:0 !important;
    margin:0 !important;
    padding:20px !important;
    box-sizing:border-box !important;
}
.cq-is-fullscreen .cq-scroll-area { max-height:calc(100vh - 180px); }
.cq-body-fullscreen { overflow:hidden; }

/* ── Paged Mode ─────────────────────────────────────────────────── */
.cq-paged-scroll { overflow:hidden; max-height:none; padding-right:0; }
.cq-page-card { animation:cq-card-in .22s ease forwards; }

.cq-page-nav-bar {
    display:flex; align-items:center; justify-content:space-between;
    gap:14px; padding:14px 16px; margin:18px 0 4px;
    background:var(--cq-bg-alt); border:1px solid var(--cq-border);
    border-radius:var(--cq-radius); box-shadow:var(--cq-elevation-1);
}
.cq-page-nav-center { display:flex; flex-direction:column; align-items:center; gap:8px; flex:1; min-width:0; }
.cq-page-counter { font-size:.92em; font-weight:700; color:var(--cq-muted); white-space:nowrap; }
.cq-page-nav-btn {
    display:inline-flex; align-items:center; justify-content:center;
    width:40px; height:40px; border-radius:var(--cq-radius-sm);
    background:var(--cq-bg); border:1.5px solid var(--cq-border);
    color:var(--cq-text); cursor:pointer; transition:all .18s; flex-shrink:0;
}
.cq-page-nav-btn:hover:not(:disabled) { background:var(--cq-accent); color:#fff; border-color:var(--cq-accent); transform:scale(1.07); }
.cq-page-nav-btn:disabled { opacity:.3; cursor:not-allowed; }
.cq-page-dots { display:flex; gap:7px; flex-wrap:wrap; justify-content:center; max-width:340px; }
.cq-page-dot {
    width:10px; height:10px; border-radius:50%;
    background:var(--cq-border); border:1.5px solid var(--cq-border);
    cursor:pointer; transition:all .18s; flex-shrink:0;
}
.cq-page-dot:hover { background:var(--cq-muted); transform:scale(1.2); }
.cq-page-dot.active { background:var(--cq-accent); border-color:var(--cq-accent); transform:scale(1.25); }
.cq-page-dot.answered { border-color:var(--cq-accent); background:rgba(var(--interactive-accent-rgb),.3); }
.cq-page-dot.active.answered { background:var(--cq-accent); }

/* ── Mobile responsive header ───────────────────────────────────── */
@media (max-width: 480px) {
    .cq-header-row { flex-wrap:wrap; gap:8px; }
    .cq-header-title-wrap { flex:1 1 100%; order:1; }
    .cq-header-title { max-width:none; font-size:1em; }
    .cq-header-actions { order:2; flex:1 1 auto; justify-content:flex-end; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .cq-timer { font-size:.95em; padding:5px 10px; }
    .cq-secondary-btn, .cq-submit-btn { font-size:.82em; padding:6px 10px; }
    .cq-page-nav-bar { flex-wrap:wrap; gap:10px; }
    .cq-page-nav-center { order:3; width:100%; }
}
`;
        document.head.appendChild(styleEl);
    }
}

class CQuizSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'CQuiz CLM Engine v5.0.0' });
        containerEl.createEl('p', { text: 'Continuous Learning Material — Advanced Quiz Engine for Obsidian', attr: { style: 'color:var(--text-muted);margin-top:0;' } });

        // ── Result Export ───────────────────────────────────────────
        containerEl.createEl('h3', { text: '📁 Export Settings', attr: { style: 'margin-bottom:4px;' } });

        new obsidian.Setting(containerEl)
            .setName('Result Export Folder')
            .setDesc('Folder where exported exam result notes are saved. Will be created automatically if it does not exist. Use / for sub-folders, e.g. "Studies/CQuiz-Results". Leave blank to save in vault root.')
            .addText(text => {
                text.setPlaceholder('CQuiz-Results')
                    .setValue(this.plugin.settings.resultFolder || 'CQuiz-Results')
                    .onChange(async (value) => {
                        this.plugin.settings.resultFolder = value.trim().replace(/^\/+|\/+$/g, '');
                        await this.plugin.saveData(this.plugin.settings);
                    });
                text.inputEl.style.width = '100%';
					//-----fix----//
					 text.inputEl.style.maxWidth='320px';
            })
            .addButton(btn => btn
                .setButtonText('Save Folder')
                .onClick(() => {
                    const folderPath = (this.plugin.settings.resultFolder || 'CQuiz-Results').trim().replace(/^\/+|\/+$/g, '');
                    if (!folderPath) { new obsidian.Notice('No folder set.'); return; }
                    const folder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (folder) {
                        const leaf = this.app.workspace.getLeaf('tab');
                        // Navigate to folder in file explorer
                        this.app.workspace.leftSplit.expand();
                        const explorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
                        if (explorerLeaf) {
                            this.app.workspace.revealLeaf(explorerLeaf);
                            explorerLeaf.view.revealInFolder && explorerLeaf.view.revealInFolder(folder);
                        }
                        new obsidian.Notice(`📁 ${folderPath}`);
                    } else {
                        new obsidian.Notice(`Folder "${folderPath}" doesn't exist yet — it will be created on next export.`);
                    }
                }));

        containerEl.createEl('br');

        // ── General ─────────────────────────────────────────────────
        containerEl.createEl('h3', { text: '⚙️ General', attr: { style: 'margin-bottom:4px;' } });

        new obsidian.Setting(containerEl)
            .setName('Debug Mode')
            .setDesc('Enable detailed console logging for troubleshooting.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableDebug)
                .onChange(async (value) => {
                    this.plugin.settings.enableDebug = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));

        containerEl.createEl('br');
        
        const dangerZone = containerEl.createDiv({ cls: 'cq-error-box', attr: { style: 'display:block;' } });
        dangerZone.createEl('h3', { text: '⚠️ Danger Zone', attr: { style: 'margin-top:0;color:inherit;' } });
        
        new obsidian.Setting(dangerZone)
            .setName('Clear Entire Database')
            .setDesc('Wipes all exam history globally from your Obsidian vault.')
            .addButton(btn => btn
                .setButtonText('Wipe All Data')
                .setWarning()
                .onClick(async () => {
                    if (confirm("WARNING: This permanently deletes ALL CQuiz exam records. Proceed?")) {
                        this.plugin.settings.history = [];
                        await this.plugin.saveData(this.plugin.settings);
                        new obsidian.Notice('CQuiz database wiped.');
                    }
                }));
        
        new obsidian.Setting(dangerZone)
            .setName('Reset Repetition Data')
            .setDesc('Clears all SM-2 spaced repetition tracking data.')
            .addButton(btn => btn
                .setButtonText('Reset Rep Data')
                .setWarning()
                .onClick(async () => {
                    if (confirm("This clears all spaced repetition progress. Proceed?")) {
                        this.plugin.settings.repetitionData = {};
                        await this.plugin.saveData(this.plugin.settings);
                        new obsidian.Notice('Repetition data reset.');
                    }
                }));
    }
}

module.exports = CQuizPlugin;
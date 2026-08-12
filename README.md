# Odoo Playwright Test Framework

E2E test framework for **Odoo 17** built with Playwright and TypeScript.  
Tests cover any Odoo module following a consistent 8-step structure across all domains.

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/Jinasena-Pvt-Ltd/odoo-playwright-tests.git
cd odoo-playwright-tests
```

### 2. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your Odoo instance URL and credentials
```

### 4. Open the team onboarding guide in Claude Code

**[https://claude.ai/claude-code/onboard/DvLm8e3KuZwg](https://claude.ai/claude-code/onboard/DvLm8e3KuZwg)** 

Claude will load the conventions, skill commands, and project context automatically.

---

## Scaffold your first module

Once the onboarding guide is loaded in Claude:

```
/add-module <your-domain>
```

This generates the full 7-step folder structure, page objects, data files, and spec stubs for your Odoo module.

---

## The 7-Step Structure

| Step | Folder | Purpose |
|------|--------|---------|
| 1 | `01-config/` | System settings, master data, prerequisites |
| 2 | `02-business/` | Core CRUD, business logic, and multi-step cross-record workflows |
| 3 | `03-reporting/` | Views, filters, exports |
| 4 | `04-permissions/` | Role-based access |
| 5 | `05-validations/` | Required fields, constraint errors |
| 6 | `06-edge-cases/` | Unusual inputs, boundaries |
| 7 | `07-archive/` | Soft-delete, reactivation |

---

## Key Commands

```bash
npm test                        # Run all tests (all roles)
npm run test:<domain>           # Run tests for a specific domain
npm run test:smoke              # Smoke tests only
npm run lint                    # TypeScript type-check
HEADLESS=false npm test         # Run with browser visible
```

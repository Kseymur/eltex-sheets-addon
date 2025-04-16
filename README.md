# ELTEX: Efficient LLM Token Extraction for Synthetic Data Generation

<p align="center">
  <img src="eltex-logo.png" alt="ELTEX Logo" width="250"/>
</p>


**ELTEX** is an experimental tool for domain-driven synthetic data generation using large language models (LLMs). This repository contains a Google Sheets Add-on that allows non-technical users to generate high-fidelity, domain-specific data directly from a familiar spreadsheet interface.

> ⚠️ This project is currently in **active development and internal testing**. The add-on is not yet available via the Google Workspace Marketplace.


## ✨ Features

- Token extraction for guiding synthetic data generation
- Multi-model support (e.g. GPT-4o, Claude 3.7, Gemini 2.0 Pro)
- Seamless integration with Google Sheets


## 🔧 How to Use (Development Version)

> To test the add-on locally, you'll need to install it manually via Google Apps Script.

### 1. Open [Google Apps Script](https://script.google.com)

- Create a new project
- Copy the contents of the `src/` folder into your project

### 2. Configure Project Properties

- Add required API keys via **File > Project properties > Script properties**
- Required keys:
  - `OPENAI_API_KEY` 
  - `ANTHROPIC_API_KEY` 
  - `GOOGLE_API_KEY`

### 3. Deploy as a Test Add-on

- In the **Deploy** menu, select **Test deployments**
- Choose **Add-on > Editor add-on**
- Select your test Google Sheet as the deployment target

## 📌 Status

- Current phase: **Active development**
- Marketplace release: **Planned**
- arXiv paper: ["ELTEX: A Framework for Domain-Driven Synthetic Data Generation"](https://arxiv.org/abs/2503.15055)

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## 🙋‍♀️ Contact & Contributions

If you're interested in collaborating, providing feedback, or trying out ELTEX for your organization, feel free to open an issue or reach out directly.

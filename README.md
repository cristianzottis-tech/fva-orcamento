# Site FVA — Orçamentação (v3)

Mudanças:
- Tema FVA (vermelho/branco) e logo em `assets/logo_fva.svg`.
- Novo campo **Nº da cotação** e botões **ENVIAR / Gerar link / Copiar link**.
- Upload e **pré-visualização** do desenho (jpg/png/pdf).
- **Prefill por URL** (usa querystring) e **gerador de link**.
- **Densidade automática** por material (alumínio/latão/aço/inox/cobre), com edição manual.
- **Peso bruto** e **peso líquido** (com campo de **remoção de material** em gramas).
- Infra de envio por e-mail: usa **mailto** (fallback). Para envio com **anexo** e rastreio, configure `FLOW_URL` (Power Automate HTTP) em `cost.js`.

Publicação:
- Substitua os arquivos do repositório (index.html, styles.css, cost.js) e adicione a pasta `assets/`.
- O workflow do GitHub Pages republica automaticamente.

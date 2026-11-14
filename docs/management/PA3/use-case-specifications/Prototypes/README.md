**Link to Figma for Reader UI prototypes:** https://www.figma.com/design/MLW8EywTbtV3AUr3wQkvnY/ShelfHelp--reader-?node-id=0-1&t=z02UTlQlhHKbyOWi-1

**Link to Figma for Admin UI prototypes:** https://www.figma.com/design/SvFuCqqWCI5nMckvxMZMI2/ShelfHelp--admin-?node-id=0-1&t=0qcBvka19yVyN4JR-1

What we aim to show in each protoype screenshots are what features we want users to see, use and how we intend to organize and present it. Note that placeholders are used for error messages, highlight tab selection, or contents in the data tables since they will be implemented with dynamic behavior later on in the app and there are too many details for us to produce variants for. We have discussed thoroughly and agreed on the features, flow and design together so every screen is designed with intention and with multiple use cases/features in mind.

---

## Screenshot → Use-case index

Each screenshot lives in a `UCxx/Reader/` or `UCxx/Admin/` folder. A screenshot is **duplicated** into every use case that references it (e.g. generic success/error, notifications, and the shared fine-checkout screen), so each folder is self-contained.

### Use cases with **no** dedicated screenshot

| UC | Why there is no screenshot |
| :--- | :--- |
| UC-12 (Renew a loan) | No standalone screen — the "Renew" action is an embedded button + confirmation dialog inside the **UC-11 Active Loans** view. |
| UC-32 (Configure policies) | **Retired** in spec v1.3 (the Settings screen was cut; the two membership tiers are fixed). |

All other use cases UC-01 … UC-31 are represented by at least one screenshot (UC-03, UC-12 and UC-30 are not empty: UC-03 maps to the `Forgot Password`/`RecoveryPIN`/`SetNewPassword` set, and UC-30 maps to `OverdueReminders`).

### Folder layout

```
Prototypes/
├── ReaderPrototypes/            # original flat dumps (kept as-is)
├── AdminPrototypes/             # original flat dumps (kept as-is)
├── UC01/
│   ├── Reader/                  # screens for this UC, reader actor
│   └── Admin/                   # screens for this UC, admin actor (if any)
├── UC02/ …
└── UC31/
```
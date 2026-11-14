# ShelfHelp: Smart Library Management System

# Software Development Plan (Small Project) — Changes (PA3)

**Version:** 1.0  
**Date:** 13/Nov/2026  
**Document Identifier:** SH-SDP-CHG-PA3  
**Performed by:** Nguyễn Minh Phú | **Reviewed by:** Phạm Võ Khang Duy | **Edited by:** Nguyễn Minh Phú  

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 13/Nov/2026 | 1.0 | Initial change record for the PA3 revision of the Software Development Plan (v2.0) | Nguyễn Minh Phú, Phạm Võ Khang Duy |

---

## Summary of Changes from PA2 Version (v1.0) to PA3 Version (v2.0)

This revision addresses the specific feedback from the Teaching Assistant (TA) on PA2 regarding **document format inconsistency**, updates the project schedule to reflect completed Sprint 2 tasks, refines the Sprint 3 backlog with actual Jira keys, incorporates administrative scope optimizations, and updates the risk register.

---

### 1. Document Format & Metadata Standardization (Addressing TA Feedback)

- **Standardized Attribution Headers:**  
  Enforced a uniform format across all sections in the document directly beneath every level-2 header (`##`):  
  `**Performed by:** <Author> | **Reviewed by:** <Reviewer> | **Edited by:** <Editor>`  
  This eliminates discrepancies in author attribution across team members.
- **Document Identifiers & Metadata:**  
  Added formal document identifiers (`SH-SDP-PA3`) and standardized versioning metadata aligned with the course RUP guidelines and Vision Document standards.
- **Table of Contents (TOC) & Section Anchors:**  
  Refactored markdown links in the Table of Contents to use standard lowercase hyphenated anchors matching GitHub Flavored Markdown (GFM) and PDF rendering engines.
- **Table Formatting:**  
  Standardized alignment syntax (`:---` for left, `:---:` for center) across all revision, deliverable, role, task, and risk tables.

---

### 2. Updates to Project Organization & Section Roles (Section 3)

- **Four-Eyes Review Enforcement:** Explicitly formalized the policy that no work item or code commit is marked "Done" without an independent reviewer.
- **Section Responsibilities:** Maintained clear author and reviewer ownership for each section between Nguyễn Minh Phú, Phạm Võ Khang Duy, Lê Văn Vĩ, Lê Minh Thuận, and Nguyễn Anh Khôi.

---

### 3. Updates to Project Plan & Sprints (Section 4.2)

- **Sprint 2 Status Update:**  
  Updated Section 4.2.2 with the completed task table for Sprint 2 (PA2), recording planned vs. actual hours and marking all 17 tasks (S2-01 through S2-17) as **Done**.
- **Sprint 3 Work Breakdown & Jira Integration:**  
  Updated Section 4.2.2 for Sprint 3 (PA3) to map directly to the Jira backlog keys (`SCRUM-62` to `SCRUM-72`):
  - Added Revised Project Plan and Changes.md (`SCRUM-62`).
  - Added Detailed Vision Document and Changes.md (`SCRUM-63`).
  - Added Use-Case Catalog definition (`SCRUM-71`) and Mermaid diagrams (`SCRUM-64`).
  - Expanded Use-Case Specifications (`SCRUM-65`) to cover all 31 use cases in RUP format.
  - Added UI Prototypes for all use cases (`SCRUM-66`).
  - Added Spec Kit end-to-end implementation of the Authentication functional group (`SCRUM-67`) and narrated demo video (`SCRUM-68`).
  - Added Weekly reports, AI usage reports, and packaging tasks (`SCRUM-69` to `SCRUM-72`).
- **Gantt Chart (Mermaid):**  
  Updated the project timeline Gantt diagram in Section 4.2.4 with explicit `:done` states for Sprint 1, Sprint 2, and Sprint 3 milestone tasks, matching the project calendar through 14/11/2026.
- **Scope Refinement Reflection:**  
  Documented the streamlining of complex administrative features (retiring UC-32 policy
  configuration and simplifying manual acquisition batches) decided during Sprint 3
  planning and retrospective.
- **Reviewer and Assignee Alignment:**  
  Corrected the Sprint 3 work-breakdown table so every row matches the attribution line
  in its own deliverable: the Vision Document and the Mermaid use-case diagrams are
  reviewed by Nguyễn Anh Khôi, AI Usage Reports and Weekly Reports are reviewed by
  Lê Văn Vĩ, and submission packaging is assigned to Nguyễn Anh Khôi as group leader.
- **Use-Case Count:**  
  Updated the milestone, backlog row, Gantt chart, and risk-register references from 32
  to 31 use cases after UC-32 was retired.

---

### 4. Updates to Quality & Monitoring Standards (Section 4.3)

- **Section 4.3.2 (Reporting and Formatting Standards):**  
  Added an explicit subsection documenting the 4 quality conventions enforced across the team to prevent document formatting mismatches.
- **Section 4.3.3 (Risk Management Register):**  
  - Updated Risk **R2** (Scope Creep): Documented active mitigation through admin feature streamlining.
  - Updated Risk **R3** (Technology Issues): Marked Spec Kit training as successfully completed.
  - Added Risk **R8** (Document Format Inconsistency): Documented the formatting checklist and review gates implemented to resolve the TA feedback.

# ShelfHelp: Vision Document

**Version:** 1.0

## 1. Introduction

**Performed by:** Lê Minh Thuận | **Reviewed by:** Nguyễn Anh Khôi | **Edited by:** Lê Minh Thuận

The purpose of this document is to collect, analyze, and define high-level needs and features of the ShelfHelp Smart Library Management System. It focuses on the capabilities needed by the stakeholders and the target users, and why these needs exist.

### 1.1 References

- Project Assignment 1 (PA1-2026): Project Proposal.
- Project Assignment 2 (PA2-2026): Guidelines and Requirements.

## 2. Positioning

**Performed by:** Lê Minh Thuận | **Reviewed by:** Nguyễn Anh Khôi | **Edited by:** Lê Minh Thuận

### 2.1 Problem Statement

|                                    |                                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The problem of**                 | inefficient, manual university library management using spreadsheets, paper cards, or outdated systems                                                                                                                     |
| **affects**                        | university students and librarians                                                                                                                                                                                         |
| **the impact of which is**         | students struggling to discover relevant reading materials based on research topics and missing due dates, while librarians waste significant time on manual record-keeping, chasing overdue books, and compiling reports. |
| **a successful solution would be** | digitizing the whole lending cycle with automated reminders, real-time inventory tracking, and integrating an AI research assistant to help students find books using natural language.                                    |

### 2.2 Product Position Statement

|                        |                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **For**                | university students and librarians                                                                                                                                                                                                                         |
| **Who**                | need an efficient, automated, and smart way to borrow, discover, and manage library resources                                                                                                                                                              |
| **The (product name)** | ShelfHelp                                                                                                                                                                                                                                                  |
| **That**               | provides a comprehensive responsive web application that digitizes the lending cycle, introduces a sustainable membership model, and offers AI-powered book recommendations                                                                                |
| **Unlike**             | traditional paper-based workflows, spreadsheets, or legacy library catalog systems                                                                                                                                                                         |
| **Our product**        | bridges the gap between digital requests and physical counter handovers, automates fee/fine calculations, and features a Retrieval-Augmented Generation (RAG) chatbot that recommends books actually held by the library based on natural-language topics. |

## 3. Stakeholder and User Descriptions

**Performed by:** Lê Minh Thuận | **Reviewed by:** Nguyễn Anh Khôi | **Edited by:** Lê Minh Thuận

### 3.1 Stakeholder Summary

| Name                               | Description                                                              | Responsibilities                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **University Institution / Board** | The governing body of the university providing the budget and oversight. | Ensures the library operates efficiently; monitors lost assets and overall revenue from memberships/fines; requires accurate statistical reporting. |
| **IT Department**                  | The technical staff of the university.                                   | Ensures system uptime, security, and maintenance of the web application and database environment.                                                   |

### 3.2 User Summary

| Name                  | Description                                                                 | Responsibilities                                                                                                                                                     | Stakeholder            |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Student (Reader)**  | University students with a university-issued email and student ID.          | Searches for books, requests/returns loans, manages memberships, pays fees/fines, writes reviews, and interacts with the AI chatbot.                                 | University Institution |
| **Librarian (Admin)** | Library staff managing daily operations at the library counter and shelves. | Manages catalog/inventory, hands over and receives books, records physical book conditions, processes in-person payments, plans acquisitions, and generates reports. | University Institution |

### 3.3 User Environment

- **Platform:** Responsive web application accessible on Windows, macOS, Android, and iOS.
- **Usage Context:**
  - **Students:** Designed mobile-first. They mostly use smartphones between classes (e.g., scanning a book's barcode at a shelf, checking due dates, chatting with AI) and laptops when studying or writing a thesis.
  - **Librarians:** Designed desktop-first. They mainly work on desktop computers at the library counter, with occasional tablet or phone use on the shelves for barcode scanning and inventory checks.
- **Hardware Interfacing:** The device's camera is utilized for avatar capture and scanning physical book barcodes.

### 3.4 Summary of Key Stakeholder or User Needs

| Need                            | Priority | Concerns                                                                            | Current Solution                                                 | Proposed Solutions                                                                                        |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Semantic Discovery**          | High     | Keyword search fails when students only know a research topic, not specific titles. | Wandering physical shelves or using inaccurate keyword catalogs. | A RAG-based AI chatbot that understands natural language and recommends relevant library books.           |
| **Automated Reminders & Fines** | High     | Students forget due dates; librarians spend too much time calculating fines.        | Manual tracking and chasing via phone calls or manual emails.    | Automated email and in-app notifications for due dates; automatic daily fine calculation.                 |
| **Accurate Asset Tracking**     | High     | Books get lost or damaged without clear accountability.                             | Spreadsheets and paper condition notes.                          | Strict handover/return workflows requiring librarians to log copy conditions; integrated Write-Off Slips. |

### 3.5 Alternatives and Competition

- **Manual Workflows (Spreadsheets & Paper Cards):** Still used by many universities. Highly prone to human error, lacks real-time updates, and offers no self-service discovery for students.
- **Legacy Library Systems:** Outdated desktop-bound software that lacks mobile responsiveness, membership revenue models, and modern AI recommendation capabilities.

# C. App Survey — Koha Staff Interface

## 1. Application Overview

- **Application:** Koha Integrated Library System (ILS)
- **Interface:** Staff Interface
- **Purpose:** To explore how Koha supports library staff in managing books, patrons, circulation activities, and other library operations.

The objective of this survey is to analyze Koha's screen structure, core functions, navigation patterns, and user experience. The findings will be used to identify strengths, weaknesses, and potential improvements for our library management application.

---

## 2. Screen Survey

### Screen 1 — Staff Homepage

**Main functions:**

- Provides access to major modules, including Circulation, Patrons, Cataloging, Reports, Tools, and Administration.
- Offers quick-access actions such as Check Out, Check In, Renew, Search Patrons, and Search Catalog.
- Displays library news and pending suggestions.

**UI/UX observations:**

- The module-based layout helps staff identify different functional areas.
- Quick actions reduce the number of steps required for frequent operations.
- Many modules have similar visual emphasis, which may make prioritization difficult.
- The large empty area could be used to display important operational information.

**Key takeaway:** The homepage provides comprehensive access to library functions but could offer a more task-oriented dashboard.

### Screen 2 — Check Out

**Main functions:**

- Search for a patron using their library card number or partial name.
- Access other circulation functions, including Check In, Renew, and Search Catalog.
- Navigate to related functions such as holds, transfers, and overdue items.

**UI/UX observations:**

- The patron search field is prominently displayed in the main content area.
- The yellow Search button makes the primary action easy to identify.
- Related circulation functions are grouped in the left sidebar.
- The large empty area provides limited contextual information before a patron is selected.

**Key takeaway:** The checkout screen prioritizes patron identification and quick access to circulation functions, but could provide more contextual guidance.

### Screen 3 — Check In

**Main functions:**

- Enter or scan an item's barcode.
- Click the Check In button to process a return.
- Access Check Out, Renew, and Search Catalog from the top navigation.
- Navigate to related circulation functions through the left sidebar.

**UI/UX observations:**

- The barcode input and Check In button are positioned close together.
- The screen focuses on the main return task.
- Its layout is consistent with the Check Out screen.
- The initial view contains a large empty area and limited instructions.

**Key takeaway:** The check-in screen offers a simple, task-focused workflow, but could provide clearer instructions and feedback.

### Screen 4 — Patrons

**Main functions:**

- Search for patron records.
- Select search fields and search types.
- Filter patrons by category and library.
- Create a new patron or use the Quick Add New Patron option.
- Access Patron Lists and browse patrons alphabetically by last name.

**UI/UX observations:**

- Multiple search options support more precise patron lookup.
- Patron creation options are visible near the top of the page.
- Alphabetical browsing provides an alternative to keyword searching.
- The search form contains several filters that may be overwhelming for new users.

**Key takeaway:** The patron screen provides flexible search and record-creation options, but could simplify its filters and improve guidance for beginners.

### Screen 5 — Cataloging

**Main functions:**

- Create a new bibliographic record.
- Import records and manage staged records.
- Export catalog data.
- Access inventory reporting and fast cataloging.
- Modify or delete multiple items or records through batch operations.
- Create labels and barcode images.
- Upload local cover images.
- Access cataloging preferences and configuration.

**UI/UX observations:**

- Functions are grouped into sections such as Import, Export, Reports, Batch Editing, Tools, and Administration.
- Batch operations support the management of multiple records or items.
- Label and barcode tools support physical library operations.
- The large number of options may make the screen difficult for new staff to navigate.

**Key takeaway:** The cataloging screen offers a comprehensive collection of catalog management tools, but could improve task prioritization and simplify navigation.

### Screen 6 — Reports

**Main functions:**

- Create guided reports or create reports using SQL.
- View saved reports and search by keyword.
- Access predefined reports, including patrons with the most checkouts and most-circulated items.
- Find reports about inactive patrons, items with no checkouts, and lost items.
- Access Statistics Wizards for acquisitions, patrons, cataloging, circulation, serials, cash register, and holds.
- Access the Reports Dictionary.

**UI/UX observations:**

- Predefined reports provide quick access to common reporting tasks.
- Statistics Wizards group reporting tools by functional area.
- Guided reports support report creation, while SQL offers an advanced option.
- The page contains many text links, which may make important options harder to distinguish.
- The initial screen presents report links rather than visual summaries of statistics.

**Key takeaway:** The reports screen offers flexible reporting options, but could improve visual hierarchy and make frequently used reports easier to find.

---

## 3. User Flow Analysis

### Flow A — Book Checkout

**Flow description:**
The staff member opens the checkout function and identifies the patron. After the patron is found, the staff member scans the book barcode. The system validates the borrowing conditions before recording the transaction and displaying the result.

### Flow B — Book Check-In

**Flow description:**
The staff member scans the returned book's barcode. The system retrieves the loan record and processes the return. If additional handling is required, the system displays the relevant warning or next action; otherwise, it confirms the return.

> These diagrams represent general library workflows. They should be verified and adjusted based on the actual Koha demo behavior.

---

## 4. UI/UX Pattern Analysis

| UI/UX Pattern | Implementation in Koha | Evaluation |
|---|---|---|
| Persistent Navigation | The top navigation bar provides access to Circulation, Patrons, Search, and other modules. | Helps staff navigate between different functional areas. |
| Category-Based Navigation | The Check Out sidebar groups functions under Circulation, Holds, Transfers, and Overdues. | Makes related functions easier to locate, although the long list may increase visual complexity. |
| Search-First Workflow | The Check Out and Patrons screens prominently display search fields. | Supports efficient patron identification and record retrieval. |
| Task-Focused Interface | The Check In screen focuses on the item barcode field and the Check In button. | Helps staff identify the primary action quickly. |
| Form-Based Interaction | The Patrons screen uses search fields, dropdown menus, and buttons to filter records. | Provides flexible searching but may overwhelm inexperienced users. |
| Category-Based Tool Grouping | The Reports and Cataloging screens organize functions into labeled sections. | Improves organization, although the number of options may make scanning more difficult. |
| Primary Action Emphasis | Yellow buttons highlight actions such as Search and Check In. | Helps distinguish primary actions from surrounding content. |

---

## 5. Overall Strengths and Weaknesses

### Strengths

- **Comprehensive Functionality:** The surveyed screens cover key library operations, including circulation, patron searching, catalog management, and reporting.
- **Consistent Navigation:** The top toolbar provides access to common functions across multiple screens.
- **Structured Organization:** Related tools are grouped into categories, especially on the Reports and Cataloging screens.
- **Efficient Search and Data Entry:** Patron search fields, barcode input, and batch-editing tools support common staff workflows.
- **Clear Primary Actions:** Buttons such as Search and Check In are visually distinguishable from the surrounding interface.

### Weaknesses

- **Underutilized Screen Space:** The Check Out, Check In, and Patrons screens contain large empty areas in their initial states.
- **High Information Density:** The Cataloging and Reports screens present many options, which may increase the learning curve for new staff.
- **Limited Visual Hierarchy:** Many secondary options appear as text links or similarly styled elements, making important functions less prominent.
- **Limited Contextual Guidance:** The initial screens provide little instruction about what users should do next.
- **Complex Navigation:** The large number of sidebar links and functional categories may make it harder for inexperienced users to find specific tools.

> These observations are based on the five screenshots provided. They describe the visible interface and do not necessarily reflect every feature or behavior available in Koha.

---

## 6. Proposed Improvements for Our Application

Based on the Koha survey, our team proposes the following improvements.

### 6.1. Simplified Navigation

Prioritize frequently used operations, such as Check Out, Check In, Search Patrons, and Search Catalog. Group less frequently used functions into collapsible sections or secondary menus.

### 6.2. Better Use of Screen Space

Use empty areas to display contextual instructions, recent activity, or relevant information when no search has been performed or no record has been selected.

### 6.3. Improved Visual Hierarchy

Use consistent typography, spacing, and visual emphasis to distinguish primary actions from secondary options. Keep important actions easy to identify without overwhelming users with too many highlighted elements.

### 6.4. Clearer Search Experience

Present the basic search option prominently and place advanced filters in a separate expandable section. Provide clear labels and helpful instructions for each search field.

### 6.5. More Informative Reporting Interface

Organize frequently used reports into a dedicated section. Where appropriate, use summary cards, tables, or charts to make important statistics easier to understand.

### 6.6. Better Contextual Feedback

Provide clear instructions before an operation and visible confirmation or error messages after an action. For example, the Check In workflow should clearly communicate whether an item has been processed successfully.

### 6.7. Role-Oriented Interface

Present functions according to staff responsibilities. For example, circulation staff could prioritize borrowing and return operations, while cataloging staff could prioritize record creation and catalog maintenance.

---

## 7. Conclusion

The Koha Staff Interface provides a comprehensive set of tools for managing library operations. Across the five surveyed screens, its main strengths include consistent navigation, category-based organization, efficient search options, and dedicated tools for circulation, cataloging, and reporting.

However, the screenshots also reveal opportunities to improve screen-space utilization, visual hierarchy, navigation simplicity, and contextual guidance.

For our application, we aim to retain Koha's functional organization while creating a more intuitive and task-oriented interface. By prioritizing common staff activities, simplifying navigation, and providing clearer feedback, our design can help staff complete daily tasks more efficiently.

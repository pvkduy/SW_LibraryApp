Performed by: Lê Minh Thuận | Reviewed by: Nguyễn Minh Phú

---

# Introduction

As part of the project proposal phase, this report surveys two existing
library management applications: the VNU-HCM Library Mobile App and the
CERN Library Catalogue. The objective is to understand existing
solutions, evaluate their user interface and workflow design, and
identify opportunities for differentiation for our proposed application.

# Common Features

Based on the survey of both the VNU-HCM Library App and the CERN Library
Catalogue, several core functional similarities were identified:

- **Core Search Functionality:** Both systems provide a prominent search
  bar as the primary tool for discovering books, documents, and
  journals.

- **Detailed Physical Copy Tracking:** Both applications display
  comprehensive details about physical copies, including title, author,
  shelving location (e.g., \"CL-General Collection\" or specific call
  numbers), barcode, and current availability status (e.g.,
  \"Available\" or \"On shelf\").

- **Direct Borrowing Actions:** Users can initiate a loan request
  directly from the item details page using primary action buttons such
  as \"Borrow\" (VNU) or \"Request loan\" (CERN).

# Proposed Differentiators (What Our App Will Do Better)

While the existing apps provide solid foundational features, our
proposed application will introduce several improvements to address
their current limitations:

- **Optimized Screen Space Utilization:** Both existing apps suffer from
  poor space management---VNU leaves significant empty space below the
  digital card, while CERN utilizes an overly large hero background
  image. Our app will replace these empty or purely decorative areas
  with highly functional content, such as active loan summaries, recent
  activity history, or personalized recommendations.

- **Refined and Accessible Search Filters:** The VNU app lacks advanced
  filtering options on the immediate search results screen, whereas CERN
  provides a filter system that is extremely dense and potentially
  overwhelming for new users. Our solution will implement a simplified,
  collapsible filter panel that provides essential refinements (e.g., by
  campus, year, or availability) without cluttering the mobile
  interface.

- **Actionable Empty States and Error Handling:** The VNU app handles
  missing data poorly by simply displaying a blank \"No data\" screen.
  Our app will feature actionable empty states, providing users with
  clear contextual feedback, suggestions to reload, or steps to refine
  their search inputs to prevent workflow disruption.

# Adopted UI/UX Patterns

To ensure a highly intuitive and efficient user experience, our
application will adopt the following successful UI/UX patterns from the
surveyed apps:

- **Search-First Design (from CERN):** We will place the search bar
  prominently on the home screen to make the primary task of information
  discovery immediately accessible.

- **Card-Based UI (from VNU):** We will use distinct visual content
  blocks (cards) for search results and item details, which optimizes
  the display of complex bibliographic information within a confined
  mobile screen space.

- **Persistent Navigation (from VNU):** A bottom navigation bar will be
  implemented to allow users to quickly switch between core features
  (Home, Search, Profile) without getting lost in deep menus.

- **Primary Action Emphasis (from both):** Crucial actions like the
  \"Borrow\" button will be visually distinct, spanning a large area,
  and anchored consistently (e.g., at the bottom of the screen) to guide
  the user seamlessly through the borrowing task.

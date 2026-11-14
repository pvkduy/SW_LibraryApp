# ShelfHelp: Master UI Design System & Screen Specification

## 1. Executive Aesthetic Framework & Design Philosophy

The ShelfHelp Smart Library Management System is envisioned as a serene, approachable, digital library companion. It bridges physical book lending with modern digital convenience. The visual and interactive foundation rests on a cozy minimal aesthetic that evokes the warmth of a physical reading nook—soft textured papers, natural wood tones, muted botanicals, and warm sunlight—while maintaining clean layout lines, generous breathing room, and friction-free digital workflows.

### 1.1 Core Aesthetic Pillars

*   **Warm Serenity & Tactile Minimalism**: Visual interfaces avoid cold industrial grays or hyper-stark contrast. Surfaces use soft off-white and cream tones paired with subtle, natural border outlines and ambient shadows. Whitespace is leveraged intentionally to reduce cognitive fatigue during book discovery and administrative catalog management.
*   **Soft Sans Typography**: Typography prioritizes human warmth and effortless readability across diverse lighting conditions and screen sizes. Soft sans-serif lettering featuring gently rounded terminals (such as Plus Jakarta Sans or Nunito) provides a friendly yet structured character.
*   **Adaptive Dual-Role Architecture**: The platform serves two distinct user cohorts with contrasting hardware contexts and operational postures:
    *   **Reader Experience (Mobile-First)**: Designed for students and patrons accessing the system primarily via smartphones. Layouts emphasize single-column stacked structures, bottom tab navigation, one-handed thumb accessibility, large touch targets, and simplified decision trees.
    *   **Admin Experience (Desktop & Landscape Optimized)**: Designed for librarians and administrative staff operating on widescreen desktop monitors. Layouts utilize multi-column dashboards, sticky navigation sidebars, high-density data grids, batch action toolbars, split-pane inspection panels, and modal workflow overlays. When accessed on handheld devices or mobile browsers during inventory floor checks, the administrative UI degrades gracefully into stacked accordions and expandable drawer panels without loss of functional capability.

---

## 2. Shared Design Tokens & Global Visual System

Design tokens serve as the unified source of truth for all visual properties across Reader and Admin experiences. They ensure brand consistency across web components, responsive viewports, and state variations.

### 2.1 Color Palette & Semantic Token Architecture

The color system combines warm organic neutrals with purposeful semantic accents to deliver clear visual feedback.

| Token Category | Token Name | Hex Code | Usage & Context |
| :--- | :--- | :--- | :--- |
| **Base Neutral** | `color-bg-base` | `#FDFBF7` | Primary canvas background; warm paper cream tone |
| **Base Neutral** | `color-bg-surface` | `#F7F4EE` | Card backgrounds, drawer panels, and table headers |
| **Base Neutral** | `color-bg-elevated` | `#FFFFFF` | Modal dialogs, dropdown menus, floating popovers |
| **Base Neutral** | `color-border-subtle` | `#E8E2D5` | Card borders, table grid lines, soft dividers |
| **Base Neutral** | `color-text-primary` | `#2C2A29` | High-contrast headers, primary titles, body text |
| **Base Neutral** | `color-text-secondary` | `#6B655E` | Subtitles, metadata labels, helper text |
| **Brand Primary** | `color-brand-oak` | `#7A4E2D` | Primary action buttons, active navigation indicators |
| **Brand Secondary** | `color-brand-sage` | `#6E8B74` | Secondary buttons, recommendation highlights, tags |
| **Brand Accent** | `color-brand-terracotta`| `#C86D51` | Featured callouts, wishlist badges, focus rings |
| **Semantic Success** | `color-status-success-bg` | `#EAF2EC` | Background for Available, Returned, Paid badges |
| **Semantic Success** | `color-status-success-fg` | `#2D5A37` | Text/icon color for positive status badges |
| **Semantic Info** | `color-status-info-bg` | `#EBF1F5` | Background for On Loan, Processing, Queued badges |
| **Semantic Info** | `color-status-info-fg` | `#2B4C63` | Text/icon color for informational status badges |
| **Semantic Warning** | `color-status-warn-bg` | `#FDF5E6` | Background for Due Soon, Pending Action badges |
| **Semantic Warning** | `color-status-warn-fg` | `#8C5411` | Text/icon color for warning status badges |
| **Semantic Danger** | `color-status-danger-bg` | `#FBEBEB` | Background for Overdue, Lost, Damaged, Suspended |
| **Semantic Danger** | `color-status-danger-fg` | `#822B2B` | Text/icon color for critical alert badges |

### 2.2 Typography Scale & Rules

Typography relies on a soft sans-serif font family (`Plus Jakarta Sans` or `Nunito`) paired with system sans-serif fallbacks. Lettering features generous x-heights and slightly rounded stroke endings.

*   **Display Header**: 32px (2.0rem) / Line Height: 1.2 / Weight: Bold (700) / Letter Spacing: -0.02em (Landing page hero, main desktop dashboard headers)
*   **Heading 1**: 24px (1.5rem) / Line Height: 1.3 / Weight: Semi-Bold (600) / Letter Spacing: -0.01em (Mobile view titles, admin section headers)
*   **Heading 2**: 20px (1.25rem) / Line Height: 1.35 / Weight: Semi-Bold (600) (Card titles, modal dialog titles)
*   **Heading 3**: 16px (1.0rem) / Line Height: 1.4 / Weight: Medium (500) (Subsection titles, table header labels)
*   **Body Base**: 14px (0.875rem) / Line Height: 1.5 / Weight: Regular (400) (Standard narrative body, form field labels, book descriptions)
*   **Body Small**: 12px (0.75rem) / Line Height: 1.5 / Weight: Regular (400) (Metadata strings, timestamp labels, table cell details)
*   **Caption / Badge**: 11px (0.6875rem) / Line Height: 1.4 / Weight: Semi-Bold (600) / Letter Spacing: 0.03em (Uppercase status badges, tag labels)

### 2.3 Spacing, Elevation, and Corner Radii

The spatial grid follows a strict 4px base increment system to ensure visual rhythm.

*   **Spacing Scale**: `space-1` (4px), `space-2` (8px), `space-3` (12px), `space-4` (16px), `space-6` (24px), `space-8` (32px), `space-12` (48px), `space-16` (64px).
*   **Border Radii**:
    *   `radius-sm` (6px): Input fields, inline badges, table rows.
    *   `radius-md` (12px): Standard cards, action buttons, mobile bottom sheet tops.
    *   `radius-lg` (18px): Large container cards, hero containers, desktop modal dialogs.
    *   `radius-full` (9999px): Pill buttons, circular avatar frames, status dots.
*   **Elevation & Drop Shadows**:
    *   `shadow-sm` (Low elevation): `0 2px 6px rgba(44, 42, 41, 0.04)` (Cards, form containers).
    *   `shadow-md` (Medium elevation): `0 6px 16px rgba(44, 42, 41, 0.07)` (Dropdowns, mobile bottom navigation).
    *   `shadow-lg` (High elevation): `0 12px 32px rgba(44, 42, 41, 0.10)` (Modal overlays, floating action sheets).

---

## 3. Shared UI Components & Pattern Specifications

Components are structured to maintain consistent visual hierarchy while adapting seamlessly between reader mobile views and librarian desktop panels.

### 3.1 Adaptive Navigation Systems

Navigation structure adjusts dynamically based on device characteristics and user privileges.

*   **Reader Mobile Navigation**:
    *   **Bottom Navigation Bar**: Fixed at the bottom of the mobile viewport with four primary destinations: Discover (Search & Recommendations), Wishlist & Cart (Staging & Reservations), Active Loans (Loans & Fee Settlements), and Profile (Account & History). Icons are paired with soft sans labels. Active states display a subtle pill background in `color-brand-sage` with primary oak tinting.
    *   **Top Bar**: Houses the ShelfHelp brand mark, quick notification bell badge, and search shortcut button.
*   **Admin Desktop Navigation**:
    *   **Sticky Left Sidebar**: Fixed 250px vertical panel featuring hierarchical navigation groups: Circulation Desk (Handover, Returns, Damage Assessment), Catalog & Inventory (Catalog Maintenance, Acquisitions, History), Patron Oversight (Accounts, Reservations, Due Items), and System Settings (Policy Config, Analytics).
    *   **Top Header Bar**: Displays global search trigger, active location/library branch selector, librarian avatar popover, and quick shortcut triggers.

### 3.2 Book Display Components & Cards

Book representation adapts based on list context and density requirements.

*   **Reader Mobile Book Card**: Displays a 2:3 aspect ratio cover thumbnail on the left with title, author, rating score, availability badge, and quick action buttons ("Add to Cart" or "Wishlist") stacked vertically on the right.
*   **Reader Grid Card**: Used in discovery screens. Features cover image, title, author, availability badge, and single-tap action trigger in a 2-column grid layout.
*   **Admin Data Grid Row**: Displays compact book metadata across tabular columns: Book Title & Author, ISBN / Barcode, Call Number, Available / Total Copies, Location Shelf, and Row Actions (Edit, Copy Breakdown, Hold Queue).

### 3.3 Form Patterns & Interactive Controls

Form controls use soft rounded styling with clear touch zones.

*   **Soft Input Field**: Rounded borders (`radius-sm`) using `color-border-subtle`, switching to `color-brand-sage` on focus with a soft glow ring. Floating labels prevent vertical jitter during user typing.
*   **Barcode Scanner Component**: Integrates device camera scanner interface with visual alignment reticle, illuminated flashlight toggle button, and manual numeric barcode input fallback field.
*   **Filter Pill Bar**: Horizontal scrolling bar featuring pill-shaped filter buttons (Genre, Availability Status, Location Branch, Publication Year). Selected pills toggle to filled sage background.

### 3.4 Comprehensive Status Badge Taxonomy

Status badges provide instantaneous visual classification across loan lifecycle, inventory state, financial receipts, and acquisition pipelines.

| Entity Domain | Status Label | Visual Style Token | Description & Context |
| :--- | :--- | :--- | :--- |
| **Loan Status** | Active Loan | `color-status-info` | Item currently checked out by patron within due date |
| **Loan Status** | Renewed | `color-status-info` | Loan extended for an additional lending period |
| **Loan Status** | Overdue | `color-status-danger` | Item passed due date without return or renewal |
| **Loan Status** | Returned | `color-status-success` | Item returned to desk and processed into catalog |
| **Loan Status** | Lost Case | `color-status-danger` | Book reported lost by patron or desk staff |
| **Reservation** | Queued | `color-status-info` | Active hold request waiting in queue for copy |
| **Reservation** | Ready for Pickup | `color-status-warn` | Copy allocated and awaiting patron desk collection |
| **Reservation** | Fulfilled | `color-status-success` | Handed over to patron; converted to active loan |
| **Reservation** | Expired / Cancelled | `color-status-neutral` | Hold window passed or cancelled by user |
| **Copy Condition** | Available | `color-status-success` | Copy on shelf ready for immediate checkout |
| **Copy Condition** | Maintenance / Damaged| `color-status-warn` | Copy under repair or pending damage assessment |
| **Copy Condition** | Written-Off | `color-status-danger` | Copy permanently removed from active circulation |
| **Financial Charge**| Unpaid Fee | `color-status-warn` | Overdue fine or replacement charge pending payment |
| **Financial Charge**| Paid | `color-status-success` | Settlement completed and receipt issued |
| **Financial Charge**| Reversal / Refunded | `color-status-neutral` | Fee waived or refunded following lost book recovery |
| **Acquisitions** | Planned | `color-status-info` | Title added to upcoming acquisition purchase list |
| **Acquisitions** | Shipment Received | `color-status-success` | Physical shipment arrived and barcode tagging ready |

---

## 4. Reader Mobile Screen Inventory

The Reader interface comprises 16 dedicated mobile screens (SCR-R01 to SCR-R16) designed specifically for touch interactions and handheld viewports.

### SCR-R01: Library Access Registration Screen

*   **Connected Use Case**: UC-01 Register for library access
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Allows non-member students and visitors to create a digital library account and select initial membership tiers.
*   **Layout & Key Components**: Soft card container featuring step indicators (1. Account Info, 2. Student Verification, 3. Membership Selection). Input fields for Full Name, Student ID, Email, Password, and Department selection. Toggle cards for Membership Plans (Standard Reader vs. Premium Research Tier).
*   **Interactive Controls**: Primary action button ("Complete Registration"), image upload trigger for Student ID card scan, inline field validation messages.

### SCR-R02: Authentication & Credentials Recovery Screen

*   **Connected Use Cases**: UC-02 Sign in and sign out, UC-03 Recover account credentials
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Handles patron sign-in, session authorization, and self-service credential recovery.
*   **Layout & Key Components**: Centered cozy card layout featuring ShelfHelp brand mark. Dual tab toggle ("Sign In" vs. "Forgot Password"). Email/Student ID field, Password input with visibility toggle, "Keep me signed in" checkbox, and OTP verification drawer for password reset.
*   **Interactive Controls**: "Sign In" button, "Send Reset Code" button, OTP numeric entry boxes, assistance link to library support.

### SCR-R03: Personal Profile & Membership Dashboard

*   **Connected Use Cases**: UC-04 Manage personal profile, UC-05 Manage membership
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Provides an overview of patron account details, digital library card, current membership plan, and tier upgrade options.
*   **Layout & Key Components**: Top profile card displaying patron photo avatar, digital barcode/QR card for physical library entry, active membership badge (e.g., "Standard Reader - Active until Oct 2027"), total borrowing limit progress bar (e.g., "3 of 5 books checked out"), and editable contact details form.
*   **Interactive Controls**: "Upgrade Membership" action sheet trigger, "Edit Profile" button, "Sign Out" button.

### SCR-R04: Book Discovery & Catalog Inspection Screen

*   **Connected Use Case**: UC-06 Discover and inspect books
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Primary landing tab for searching, filtering, and browsing catalog holdings.
*   **Layout & Key Components**: Search input bar with quick barcode scanner shortcut button. Scrollable filter pill bar (Genres, Availability, Location). Two-column book grid displaying cover images, titles, authors, star ratings, and real-time availability badges.
*   **Interactive Controls**: Single-tap card navigation to detail view, quick "Add to Cart" icon overlay button, pull-to-refresh control.

### SCR-R05: Book Detail & Availability Panel

*   **Connected Use Case**: UC-06 Discover and inspect books
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: In-depth inspection of book metadata, physical copy locations, summary description, and user reviews.
*   **Layout & Key Components**: Hero cover display with soft background blur. Book Title, Author, Publisher, Publication Year, ISBN, Call Number, and Shelf Location card (e.g., "Floor 2 - Shelf B4"). Real-time status breakdown ("2 Copies Available, 1 On Reserve"). Collapsible reader reviews section.
*   **Interactive Controls**: Floating bottom action bar containing "Add to Cart", "Save to Wishlist", and "Reserve Copy" buttons.

### SCR-R06: Barcode Scanner Modal Screen

*   **Connected Use Case**: UC-07 Find a book by barcode
*   **Primary Viewport**: Mobile Portrait Overlay (375px–430px)
*   **Screen Purpose**: Utilizes smartphone camera to scan physical book ISBN barcodes inside the library for instant digital lookup.
*   **Layout & Key Components**: Full-screen camera viewfinder overlay with central target reticle bounding box. Flashlight toggle icon, switch camera toggle, manual ISBN numeric entry fallback bottom drawer.
*   **Interactive Controls**: Immediate auto-redirect upon successful barcode match to SCR-R05 Book Detail Screen.

### SCR-R07: Book Wishlist Curation Screen

*   **Connected Use Case**: UC-08 Manage a book wishlist
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Personal saved list for organizing titles intended for future reading or research.
*   **Layout & Key Components**: Vertical card list of wishlisted titles. Each card features cover thumbnail, title, author, current availability tag, and custom user note input. Multi-select edit mode header bar.
*   **Interactive Controls**: Swipe-to-delete gesture, "Move to Borrowing Cart" button, share wishlist link button.

### SCR-R08: Borrowing Cart & Pre-Checkout Staging Screen

*   **Connected Use Case**: UC-09 Manage borrowing cart
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Staging area for selecting books to check out during the current library visit.
*   **Layout & Key Components**: Selected books list with item removal triggers. Patron checkout quota calculator bar (e.g., "Selected: 2 / Remaining Quota: 3"). Warning callout cards for items currently checked out by others with instant "Convert to Reservation" buttons.
*   **Interactive Controls**: "Proceed to Checkout" primary sticky bottom button, clear cart trigger.

### SCR-R09: Checkout QR Code & Confirmation Screen

*   **Connected Use Case**: UC-10 Check out books
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Generates a digital checkout ticket and QR verification code for desk handover or self-service kiosk processing.
*   **Layout & Key Components**: Prominent high-contrast QR code container displaying checkout transaction ID, selected book list summary, pickup deadline countdown timer, and desk collection instructions.
*   **Interactive Controls**: "Save QR to Photos" button, "View Active Loans" shortcut button.

### SCR-R10: Active Loans, Charges, and Payment History Screen

*   **Connected Use Case**: UC-11 View loans, charges, and payment history
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Main dashboard for monitoring active borrowed items, upcoming due dates, outstanding fees, and past transactions.
*   **Layout & Key Components**: Segmented top control tab ("Active Loans", "Outstanding Fees", "Payment Receipts"). Active loans list displaying days remaining progress bar, due date label, and renewal count indicator. Outstanding fees section displaying charge breakdowns (Overdue Fine vs. Replacement Fee).
*   **Interactive Controls**: "Renew Loan" inline button, "Pay Charge Now" primary button, digital receipt PDF view trigger.

### SCR-R11: Self-Service Loan Renewal Modal

*   **Connected Use Case**: UC-12 Renew a loan
*   **Primary Viewport**: Mobile Portrait Sheet (375px–430px)
*   **Screen Purpose**: Allows readers to extend borrowing period for eligible active loans.
*   **Layout & Key Components**: Bottom sheet card displaying book title, current due date, calculated new due date upon renewal, and remaining renewal allowance count. Warning banner displayed if title is reserved by another patron (preventing renewal).
*   **Interactive Controls**: "Confirm Renewal" button, "Cancel" button.

### SCR-R12: Fee Payment & Settlement Screen

*   **Connected Use Case**: UC-13 Pay a charge
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Facilitates digital payment of overdue fines or replacement fees via online gateway options or library counter code.
*   **Layout & Key Components**: Itemized fee summary card (Book title, fine period, fee rate). Payment method selection cards (Credit Card, Digital Wallet, Counter Cash Ticket QR). Total payment calculator box.
*   **Interactive Controls**: "Pay Now" secure button, payment cancellation link.

### SCR-R13: Book Reservation & Hold Queue Screen

*   **Connected Use Case**: UC-14 Reserve an unavailable book
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Enables readers to place a reservation request on books currently checked out by others.
*   **Layout & Key Components**: Reservation configuration card displaying current hold queue position (e.g., "Queue Position: #2"), estimated wait time, pickup branch selection, and notification preference toggles (SMS / Email).
*   **Interactive Controls**: "Confirm Reservation" button, queue cancellation trigger.

### SCR-R14: Book Review & Rating Submission Screen

*   **Connected Use Case**: UC-15 Rate and review a returned book
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Post-return feedback screen encouraging readers to submit star ratings and textual reviews.
*   **Layout & Key Components**: Returned book cover header, interactive 5-star rating control, multi-tag feedback selection buttons (e.g., "Insightful", "Easy Read", "Academic Focus"), text review area with character counter.
*   **Interactive Controls**: "Submit Review" button, "Skip" text link.

### SCR-R15: Book Suggestion Submission Screen

*   **Connected Use Case**: UC-16 Manage book suggestions
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Allows readers to recommend new book titles for library acquisition.
*   **Layout & Key Components**: Form inputs for Book Title, Author, ISBN (optional), Genre, Estimated Price, and Reason for Suggestion text area. Status tracker tab showing past submitted suggestions ("Under Librarian Review", "Approved for Purchase", "Purchased").
*   **Interactive Controls**: "Submit Suggestion" button, suggestion history filter pills.

### SCR-R16: AI Research Recommendations & Notification Drawer

*   **Connected Use Cases**: UC-17 Get research recommendations, UC-28 View notifications
*   **Primary Viewport**: Mobile Portrait (375px–430px)
*   **Screen Purpose**: Delivers personalized academic research recommendations and library system notifications.
*   **Layout & Key Components**: Dual tab layout ("AI Recommendations" vs. "Activity Notifications"). Recommendations tab displays AI-curated reading cards with relevance explanation chips (e.g., "Recommended based on your recent loan of Machine Learning Principles"). Notifications list showing due date alerts, pickup readiness notices, and fine payment confirmations.
*   **Interactive Controls**: "Add Recommended Book to Cart", "Mark All Notifications as Read", tap-to-view notification target.

---

## 5. Admin Desktop Screen Inventory & Graceful Degradation Layouts

The Administrative interface comprises 16 widescreen screens (SCR-A01 to SCR-A16) optimized for landscape desktop monitors ($1280\text{px}-1920\text{px}$) with dedicated responsive degradation rules for mobile/tablet viewports.

### SCR-A01: Master Circulation Desk Dashboard

*   **Connected Use Cases**: UC-20 Hand over requested books, UC-21 Process a book return
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Central operational dashboard for library staff managing daily checkouts, pickups, and return desk processing.
*   **Layout & Key Components**: Split-screen dual panel layout. Left Panel: Rapid Barcode / Student ID lookup input, active queue list of ready pickup items. Right Panel: Active transaction inspector showing patron photo, account standing badge, scanned item details, and quick desk action tools.
*   **Interactive Controls**: "Process Handover" button, "Scan Return Item" trigger, "Flag Damage" button.
*   **Mobile/Tablet Degradation**: Collapses into a single-column view with top toggle tabs ("Lookup / Handover" vs. "Return Scanner"). Scanner drawer overlays full screen on mobile.

### SCR-A02: Return Processing & Damage Assessment Workspace

*   **Connected Use Cases**: UC-21 Process a book return, UC-22 Assess damage and write off copies
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Specialized workspace for inspecting returned physical items, recording wear/damage, calculating fines, or triggering copy write-offs.
*   **Layout & Key Components**: Item condition evaluation form card. Book copy barcode inspector, wear condition selector radio cards (Normal Wear, Minor Damage, Severe Damage, Missing Pages), automated penalty fine calculator box, and write-off justification field.
*   **Interactive Controls**: "Complete Return & Restock", "Apply Damage Fee & Notify Student", "Write-Off Copy Permanently".
*   **Mobile/Tablet Degradation**: Transforms into a step-by-step vertical modal wizard with expandable image upload controls for recording damage photos.

### SCR-A03: Lost Book Case Resolution Workspace

*   **Connected Use Case**: UC-18 Resolve a lost-book case
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Administrative control suite for settling lost book claims, issuing replacement charges, or processing refunds when lost items are recovered.
*   **Layout & Key Components**: Case summary panel showing patron history, book title, original due date, and days elapsed. Path selector tabs: Path A (Patron brings replacement physical copy) vs. Path B (Patron settles replacement cost fee). Automatic 90-day recovery refund calculator banner.
*   **Interactive Controls**: "Approve Replacement Copy", "Assess Replacement Fee", "Process 90-Day Refund Reversal".
*   **Mobile/Tablet Degradation**: Single-column stacked cards with collapsible transaction history drawers.

### SCR-A04: Catalog & Physical Copy Maintenance Center

*   **Connected Use Case**: UC-19 Maintain catalog and copies
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Management hub for editing title metadata, adding new physical inventory copies, and managing barcode assignments.
*   **Layout & Key Components**: High-density data grid listing catalog titles with quick search and multi-attribute filters. Expandable row panel revealing individual physical copy barcodes, branch locations, shelf call numbers, and condition statuses.
*   **Interactive Controls**: "Add New Title", "Add Physical Copy", "Bulk Barcode Export", "Edit Metadata".
*   **Mobile/Tablet Degradation**: Data grid converts to a searchable card list with expandable accordions for physical copy details.

### SCR-A05: Receipts, Payments, and Financial Reversals Ledger

*   **Connected Use Case**: UC-23 Manage receipts and reversals
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Complete financial audit trail for library revenue, fine collection, payment receipts, and fee reversals.
*   **Layout & Key Components**: Financial summary metrics cards (Total Collected This Month, Outstanding Fines, Total Reversals Issued). Searchable receipts data table with columns for Receipt ID, Date, Student Name, Fee Type, Payment Method, Amount, and Reversal Status.
*   **Interactive Controls**: "Issue Fee Reversal", "Export Financial Ledger (CSV/PDF)", "Print Physical Receipt".
*   **Mobile/Tablet Degradation**: Metric cards collapse to a 2-column grid; data table transforms into compact transaction summary cards with a filter drawer.

### SCR-A06: Acquisition Planning & Suggestion Review Center

*   **Connected Use Case**: UC-24 Plan book acquisitions
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Tools for reviewing reader suggestions, synthesizing demand trends, and compiling bulk book purchase orders.
*   **Layout & Key Components**: Split layout. Left Panel: Aggregated student suggestions ranked by request frequency. Right Panel: Active Acquisition Plan draft containing order quantities, estimated budget totals, supplier selections, and priority tags.
*   **Interactive Controls**: "Approve Suggestion to Plan", "Reject Suggestion with Reason", "Export Purchase Order PDF".
*   **Mobile/Tablet Degradation**: Tabbed interface switching between "Patron Suggestions" list and "Draft Purchase Order" list.

### SCR-A07: Acquisition Shipment Receiving & Barcode Intake Workspace

*   **Connected Use Case**: UC-25 Receive an acquisition shipment
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Intake center for verifying incoming physical book shipments against purchase orders and generating barcode tags.
*   **Layout & Key Components**: Purchase order verification list. Expected vs. Received copy counter input fields, automatic sequential barcode range generator box, print label alignment layout preview card.
*   **Interactive Controls**: "Generate & Print Barcode Labels", "Mark Shipment Complete", "Flag Missing Items".
*   **Mobile/Tablet Degradation**: Mobile camera barcode tag verification view with step-by-step shipment checklist.

### SCR-A08: Inventory Log & Audit Trail Inspector

*   **Connected Use Case**: UC-26 Review inventory history
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Comprehensive audit log tracking every physical copy movement, state change, checkouts, returns, maintenance, and write-offs.
*   **Layout & Key Components**: Master audit timeline grid featuring date/time stamps, copy barcodes, staff handler ID, previous status, updated status, and operational event tags.
*   **Interactive Controls**: Filter by Date Range, Filter by Staff Operator, Filter by Event Type, "Export Audit Log".
*   **Mobile/Tablet Degradation**: Stacked vertical timeline view with collapsible audit event detail popovers.

### SCR-A09: Analytics Dashboard & Executive Report Generator

*   **Connected Use Case**: UC-27 Review analytics and export reports
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Visual analytics suite illustrating circulation velocity, popular genres, overdue trends, patron engagement, and collection utilization.
*   **Layout & Key Components**: Metric overview cards (Active Circulation Rate, Average Loan Duration, Turnaround Rate). Interactive chart panels (Borrowing Trends Over Time, Top 10 Most Reserved Books, Genre Distribution). Custom report export configuration form.
*   **Interactive Controls**: Chart timeframe toggles (7 Days, 30 Days, 1 Year), "Export Analytics Report (PDF/Excel)", "Schedule Automated Report Email".
*   **Mobile/Tablet Degradation**: Charts re-render into full-width stacked viewports; export configurations open in a full-screen drawer.

### SCR-A10: Reservation Queue Supervision Panel

*   **Connected Use Case**: UC-29 Oversee reservation queues
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Allows administrative staff to monitor hold queues, re-order patron priorities for special research needs, or cancel stale holds.
*   **Layout & Key Components**: Multi-column reservation queue table sorted by title, showing total queue depth, allocated copies, patron queue positions, hold request dates, and pickup status deadlines.
*   **Interactive Controls**: Drag-and-drop queue priority re-ordering control, "Reassign Hold Copy", "Cancel Reservation Request".
*   **Mobile/Tablet Degradation**: Queue items displayed as collapsible priority cards with quick action modal triggers.

### SCR-A11: Overdue Management & Reminder Dispatch Hub

*   **Connected Use Case**: UC-30 Review due items and send reminders
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Tracking center for overdue borrowing items and dispatching manual or automated notification reminders to patrons.
*   **Layout & Key Components**: Categorized list of loans nearing due date or overdue (1-3 Days Overdue, 4-7 Days Overdue, 7+ Days Critical). Automated fine calculation preview, customizable email/SMS notification template drawer.
*   **Interactive Controls**: "Send Individual Reminder", "Batch Send Overdue Notices", "Apply Manual Fine Waiver".
*   **Mobile/Tablet Degradation**: Compact card list with quick swipe-to-remind action gestures.

### SCR-A12: Student & Patron Account Administration Center

*   **Connected Use Case**: UC-31 Manage student accounts
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Administrative control panel for inspecting patron profiles, managing borrowing privileges, issuing disciplinary account holds, or manual tier adjustments.
*   **Layout & Key Components**: Master patron user grid showing Student Name, ID, Department, Current Membership Plan, Active Loans count, Unpaid Fines total, and Account Status (Active, Flagged, Suspended). Detailed patron inspect drawer showing borrowing history logs.
*   **Interactive Controls**: "Place Account Hold", "Remove Suspension", "Update Membership Plan", "View Full Borrowing History".
*   **Mobile/Tablet Degradation**: User list converted to searchable contact cards with slide-out profile details.

### SCR-A13: Policy Configuration & Membership Tier Editor

*   **Connected Use Case**: UC-32 Configure library policies and membership tier policies
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: System setting suite for configuring global loan limits, checkout duration rules, fine rates per day, renewal allowances, and the two fixed membership tier policies (Standard unpaid rank and yearly Premium).
*   **Layout & Key Components**: Form cards organized by policy domain: 1. Borrowing Rules (Max items allowed, loan duration days per plan), 2. Overdue Fine Schedules (Grace period days, daily fine rate, max fine cap), 3. Reservation Rules (Max active holds, pickup window days), 4. Membership Tier Definitions.
*   **Interactive Controls**: "Save Policy Changes", "Reset to Default Rules", policy version history view.
*   **Mobile/Tablet Degradation**: Vertical accordion form panels with sticky bottom "Save Changes" bar.

### SCR-A14: Admin Notification & System Alert Inbox

*   **Connected Use Case**: UC-28 View notifications
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Internal notification center alerting staff to low stock thresholds, overdue critical cases, reservation queue bottlenecks, and policy exceptions.
*   **Layout & Key Components**: Filterable alert stream categorized by priority level (Urgent, Warning, Informational). Alert cards display timestamps, related entities (Book, Patron, Order), and direct action links.
*   **Interactive Controls**: "Mark as Resolved", "Filter by Alert Type", "Navigate to Target Workspace".
*   **Mobile/Tablet Degradation**: Full-width alert card feed with top filter pills.

### SCR-A15: Bulk Export & Data Exchange Center

*   **Connected Use Cases**: UC-27 Review analytics and export reports, UC-26 Review inventory history
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Utility screen for exporting custom system datasets, catalog backups, circulation logs, and financial records in standardized formats.
*   **Layout & Key Components**: Export dataset selector cards (Catalog Metadata, Patron Records, Circulation History, Financial Receipts). Format options radio selector (CSV, Excel, JSON, PDF). Date range picker and field filter options.
*   **Interactive Controls**: "Generate & Download File", "Schedule Recurring Export".
*   **Mobile/Tablet Degradation**: Stacked form container with download progress bar overlay.

### SCR-A16: Admin Staff Authorization & Session Management

*   **Connected Use Cases**: UC-02 Sign in and sign out, UC-32 Configure library policies and membership tier policies
*   **Primary Viewport**: Desktop Landscape (1280px–1920px)
*   **Screen Purpose**: Secure authentication and role-based access management portal for library staff and system administrators.
*   **Layout & Key Components**: Staff sign-in card with multi-factor authentication (MFA) token prompt. Active staff session log showing logged-in library desk terminals and permission audit scopes.
*   **Interactive Controls**: "Authenticate Session", "Revoke Desk Terminal Session", "Change Security PIN".
*   **Mobile/Tablet Degradation**: Compact centered card with numeric MFA keypad drawer.

---

## 6. End-to-End User Flow Specifications

The ShelfHelp user flows weave individual use cases into continuous end-to-end operational journeys for both readers and administrative staff.

### Flow 1: Reader Registration, Onboarding, and Plan Selection

*   **Step 1 (SCR-R01 Registration)**: Unauthenticated visitor launches registration screen, inputs personal details, and uploads student ID scan (UC-01).
*   **Step 2 (SCR-R03 Profile & Membership)**: System verifies student record; user selects Standard or Premium Membership plan (UC-05).
*   **Step 3 (SCR-R02 Authentication)**: User completes email verification and signs into active session (UC-02).
*   **Step 4 (SCR-R03 Digital Card)**: Account dashboard generates digital barcode/QR library card for immediate system access.

### Flow 2: Book Discovery, Cart Staging, and Digital Checkout

*   **Step 1 (SCR-R04 Search & Discover)**: Reader searches catalog via keywords or scans physical book barcode in library stacks (UC-06, UC-07).
*   **Step 2 (SCR-R05 Book Inspection)**: Reader inspects title availability, shelf location, and user reviews. Alternatively views AI research recommendations (UC-17).
*   **Step 3 (SCR-R08 Cart Staging)**: Reader adds desired available books to borrowing cart (UC-09) or saves to wishlist (UC-08).
*   **Step 4 (SCR-R09 Checkout QR)**: Reader confirms cart checkout, generating a digital pickup ticket and QR code (UC-10).

### Flow 3: Circulation Desk Handover, Loan Monitoring, and Return

*   **Step 1 (SCR-A01 Circulation Desk)**: Reader presents QR code at library counter; librarian scans QR code to verify eligibility and hands over books (UC-20).
*   **Step 2 (SCR-R10 Active Loans Dashboard)**: Reader monitors active loan due dates on mobile app (UC-11).
*   **Step 3 (SCR-R11 Renewal)**: Prior to due date, reader self-renews eligible loan for an extended borrowing period (UC-12).
*   **Step 4 (SCR-A02 Desk Return)**: Reader returns book to library desk; librarian scans item barcode to process return, inspect condition, and restock (UC-21).
*   **Step 5 (SCR-R14 Rating & Review)**: Upon return processing, reader receives mobile prompt to rate and review the book (UC-15).

### Flow 4: Unavailable Book Reservation and Hold Queue Allocation

*   **Step 1 (SCR-R05 / SCR-R13 Reservation Request)**: Reader discovers a desired title with zero available copies and places a hold request (UC-14).
*   **Step 2 (SCR-A10 Queue Supervision)**: System places request in reservation queue; librarian monitors queue depth and priority allocations (UC-29).
*   **Step 3 (SCR-A02 Return Trigger)**: Another patron returns a copy of the reserved book; system automatically allocates copy to next queued reader and issues notification (UC-28).
*   **Step 4 (SCR-R16 Notification & Desk Pickup)**: Reader receives "Ready for Pickup" alert with a 48-hour pickup window (UC-28) and visits desk for handover (UC-20).

### Flow 5: Fee Settlement, Receipts, and Lost Book Case Resolution

*   **Step 1 (SCR-R10 / SCR-A11 Overdue Alert)**: Patron accumulates an overdue fine or reports a lost book case (UC-11, UC-18, UC-30).
*   **Step 2 (SCR-A03 Lost Case Workspace)**: Librarian inspects lost book case and agrees on settlement path: Path A (replacement physical copy) or Path B (replacement fee) (UC-18).
*   **Step 3 (SCR-R12 Payment Gateway)**: Patron settles outstanding fee via mobile payment gateway or desk counter (UC-13).
*   **Step 4 (SCR-A05 Ledger & Receipt)**: System issues digital payment receipt and logs financial transaction (UC-23). If lost book is recovered within 90 days, librarian processes refund reversal (UC-23).

### Flow 6: Book Suggestions, Acquisition Planning, and Inventory Intake

*   **Step 1 (SCR-R15 Reader Suggestion)**: Reader submits a request for a new book title not currently in library catalog (UC-16).
*   **Step 2 (SCR-A06 Acquisition Center)**: Librarian reviews aggregated suggestions, approves purchase, and adds title to bulk acquisition plan (UC-24).
*   **Step 3 (SCR-A07 Shipment Intake)**: Physical shipment arrives; librarian verifies contents against purchase order and generates sequential barcode tags (UC-25).
*   **Step 4 (SCR-A04 Catalog Maintenance)**: Librarian registers new copies into active catalog (UC-19), recording intake event in inventory audit log (UC-26).

---

## 7. AI Agent Prompting Directives & System Implementation Rules

This master file is formatted to be consumed directly by AI code generation agents (such as v0, Bolt, Claude, or Figma AI) to construct complete, consistent frontend components and responsive page viewports.

### 7.1 Instruction Interpretation Rules for AI Agents

*   **Token Strictness**: All generated styles must reference the exact design tokens specified in Section 2. Never introduce arbitrary color hex values (e.g., `#000000` or `#FFFFFF` pure stark neutrals). Use `color-bg-base`, `color-text-primary`, and `color-border-subtle`.
*   **Typography Compliance**: Apply soft sans-serif styling exclusively (`Plus Jakarta Sans` or `Nunito`). Set rounded corners on all button, card, and input containers following the `radius-sm`, `radius-md`, and `radius-lg` rules.
*   **Viewport Rules**:
    *   When generating Reader viewports (SCR-R01 to SCR-R16), target mobile dimensions ($375\text{px} \times 812\text{px}$). Enforce bottom tab navigation and thumb-friendly touch targets ($\ge 44\text{px}$).
    *   When generating Admin viewports (SCR-A01 to SCR-A16), target desktop landscape dimensions ($1920\text{px} \times 1080\text{px}$). Enforce left sticky sidebar navigation, high-density data tables, and multi-column split workspace cards. Include responsive breakpoint media queries (`@media (max-width: 768px)`) that execute the graceful degradation rules specified for each admin screen.
*   **Status Badge Rendering**: Whenever rendering entity statuses, query the Status Taxonomy in Section 3.4 and apply the corresponding semantic color tokens (`color-status-success`, `color-status-info`, `color-status-warn`, `color-status-danger`, `color-status-neutral`).

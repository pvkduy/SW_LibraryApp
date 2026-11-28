# **ShelfHelp: Smart Library Management System \- Project Proposal**

## **3\. Key Features (Functional Groups)**

### **3.1 Account, Authentication**

Students register with their university email and student ID, verify their email, log in and out, and reset a forgotten password through an emailed link. Role-based access control separates student and librarian areas, so students can never reach admin functions. Thus, this protects personal borrowing data and ensures only authorized staff can change inventory or payments. Accounts also have a lifecycle: when a student graduates or leaves, an administrator moves the account to Inactive, which is only allowed once all books are returned and no debt remains, mirroring the "no library debt" clearance many universities already require. 

### **3.2 Profile and Membership** 

Students edit their personal information (name, phone, faculty), change their password, and update their avatar by uploading an image or capturing one with the camera, with cropping before saving. These features enable students to manage their personal accounts conveniently while ensuring information accuracy and account security.

Besides, the same profile area holds their membership: they can buy or renew a plan for an academic year, see its status, expiry date, and the exact privileges. Plans are prepaid, one-time purchases renewed manually, with an email reminder about 7 days before expiry. Members borrow Premium titles (high-demand textbooks, newest editions, research references, theses) for free, may hold more books at once, get longer loan periods and more renewals, and can reserve books that are currently unavailable. Non-members can still borrow Premium titles by paying a small per-book fee, and Standard books are free for everyone. The librarian configures plan prices, limits, and which titles are Premium as settings, without code changes. 

For example, as default:

|  | Non-member | Member |
| :---- | :---- | :---- |
| Standard books | Free | Free |
| Premium books | Fee per book per loan (e.g., 5,000 VND / 7 days) | Free |
| Max books at once | 3 | 7 |
| Loan period | 7 days | 14 days |
| Renewals | 1 | 2 |
| Reservation of unavailable books | No | Yes (48h hold limit per copy) |
| Fine for late returns | Yes | Yes (same rate, to keep fairness) |

To keep the model fair and auditable, every purchased membership stores a snapshot of what was bought (plan name, price paid, start and end dates), so later price or benefit changes apply only to new purchases and never retroactively. A student's status is computed from the end date. The whole-degree plan ends on the student's expected graduation date and is extended if the date changes, so it never outlives student status. Plans cannot be transferred, and online purchases are non-refundable except for exceptions handled by an administrator. If a membership expires while books are on loan, existing loans keep their due dates and no fee is charged retroactively, but the student cannot borrow beyond the lower non-member limit until enough books are returned.

### **3.3 Search, Browse, and Barcode Scan**

Students search for books by title, author, ISBN, or keyword, and refine results using filters such as category, field, publication year, language, and collection type (Standard or Premium), with sorting options based on relevance, recency, rating, or popularity. Browse views like new arrivals and top books display a paginated grid with key information, while detailed book pages provide descriptions, availability, shelf location, ratings, reviews, and a Wishlist button ("Notify me when available"). Students can also scan a book’s ISBN barcode using their phone camera to open its details instantly. These flexible discovery tools help students locate specific textbooks or explore relevant reading materials in seconds, eliminating time wasted wandering physical library stacks or searching with inaccurate catalog terms. 

### **3.4 Borrowing Cart, Reservations, and Payment**

Students add available books to a cart, choose the loan duration, and review the total fee. Free requests (Standard books for all students, or Premium books for active members) bypass the payment step and immediately become Ready for Pickup. Paid requests for Premium books by non-members start at Awaiting Payment until the per-book fee is settled through a simulated payment gateway or designated for counter payment. At checkout, the system validates stock, creates a loan request, and holds the selected copies for pickup, preventing the same copy from being reserved twice. If a paid request is cancelled or expires, its payment is marked Refunded and the held copies are released. The actual loan and due date begin only when the librarian confirms the handover at the counter. 

Members can reserve unavailable books through a limited queue. When a copy becomes available (returned or newly imported), it is held for the first member in the reservation queue with a 48-hour pickup window (Ready for Pickup) and an automated notification is sent. If the hold expires after 48 hours without collection, the reservation is automatically cancelled (Expired) and passed to the next member in queue, or released to general borrowing and Wishlist users if no queue remains. To prevent reservation hoarding, a first expired reservation triggers a formal system warning, while a second expiration temporarily restricts the member from placing new reservations for a configured penalty period (e.g., 30 days). 

### **3.5 Loan Tracking, Ratings, Fines, and Reminders**

A "My Loans" page splits records into Ongoing and History and displays each request or loan's status: Awaiting Payment, Payment Failed, Ready for Pickup, Expired, Cancelled, Borrowed, Overdue, and Returned. For ongoing borrowed loans, students can click a renew button to instantly extend the due date, provided that the book has no active reservation queue and their membership renewal limit has not been reached. Active requests display a 48-hour pickup countdown to help students keep track before cancellation, and for online paid requests that expire or are cancelled, the simulated payment transaction is logged separately as Refunded. 

After returning a book, a student can give a 1-5 star rating and a short review, which feeds the popularity and recommendation features. 

For overdue loans, the system automatically calculates a daily fine and displays the amount. Fines can be paid through the simulated online payment gateway or at the counter, but loans are closed only when books are physically returned and confirmed by a librarian. Unpaid fines and fees restrict students from starting new loan requests until settled. If a loan remains overdue past a critical threshold (e.g., 2 months), the system automatically converts it into a Lost record, updates the physical copy status to Lost, and moves the student's account to Restricted status, preventing further use of library services. To lift this restriction, the student must return the physical book and settle all associated fees and replacement charges, after which an administrator manually verifies the settlement to restore full account access.

Reminders combine automation and manual control. Scheduled jobs automatically email students on their due date, send weekly overdue email notices for up to two weeks, remind members before their membership expires, and send email alerts when a 48-hour pickup window is close to expiring. For in-app notifications, the notification center alerts students 2 days before the due date, on the due date, and upon becoming overdue or reaching pickup deadlines. On the admin dashboard, librarians see loans due or overdue grouped by day and week, with a "Remind all" button that sends bulk in-app notifications to affected students.

### **3.6 Book Suggestions and Acquisition Batches**

If a student cannot find a book, they submit a suggestion request with the title, author, ISBN or link, and a short reason. Similar requests are grouped automatically to show demand, and the librarian reviews the queue to approve or reject requests, notifying students of the outcome at each step. Approved book requests are accepted for purchase in the upcoming acquisition batch (e.g., "Semester 2, 2026"). The librarian builds the batch list by adding titles with requested quantities, which can be exported as CSV, PDF, or Excel for the procurement department, while actual purchasing operations remain outside the system. When books arrive, the librarian imports them against the batch, recording receipts, closing the batch, and notifying the students who requested them. 

Each batch has its own detail page showing ordered versus received quantities, exported list versions, receipt records, and an activity log. Batch receipts are also logged on the library-wide Inventory history page 

### **3.7 Inventory and Circulation (Admin)**

Librarians add books one at a time (choosing from a library catalog, scanning an ISBN to auto-fill metadata, or entering a new title) or in bulk by importing a CSV list, and they edit metadata, including the Standard or Premium collection. Each physical copy has its own record with a barcode label, a status (available, borrowed, damaged, under repair, lost, retired), and a shelf location that is shown to staff and students. Every change in the number of copies is stored as an inventory transaction with a type (batch receipt, manual addition, write-off, found), a reference, and a reason, so stock figures can always be explained. 

At the counter, the circulation view lists each loan with borrower name, student ID, borrow date, due date, and return date. To hand over a book, the librarian searches for the request, records its initial condition, and clicks to confirm the handover, which converts the request into an active Borrowed loan and starts the loan period. To end a loan, the librarian opens the active record or scans the loaned book’s barcode, records the returned condition, charges any overdue fine or damage/loss fee if applicable, and clicks to confirm the return. Upon confirmation, stock counts update automatically and the student is invited to rate the book. 

If damage or loss fees remain unpaid, the loan is closed, but any remaining library debt restricts the student from starting new loan requests until settled. Furthermore, if a loan remains overdue past a critical threshold (e.g., 2 months), the system automatically flags the copy as Lost and moves the student's account to Restricted status, preventing further use of library services until the book is returned, fees are settled, and an administrator manually verifies the restoration. Librarians can also manually set a copy to Lost during audits, and every status change is logged for accountability. 

Dedicated inventory history tracks every copy transaction in a single log, recording the timestamp, operator (or system automated process), book title, copy count, transaction type, reason, and reference link (such as batch receipts, write-off slips, or loans). Quick filters allow librarians to separate batch receipts, manual additions (donations, replacements, found items), and stock reductions  (both manually and auto-flagged). The log is fully searchable by book and exportable as CSV, PDF, or Excel. While batch receipts link directly to their respective batch management pages, manual additions, automated system loss flags  and individual copy histories are fully traceable here, ensuring complete accountability for all physical stock. 

### **3.8 Book Condition Tracking & Write-Off (Admin)**

To determine liability, the librarian must manually record the book's condition at handover and return (modify the related loan record).

Confirmed missing, damage reports, and librarian-initiated removals for worn-out or obsolete books share a single flow built around a Write-Off Slip. The slip can cover multiple physical copies, recording the reason, evidence photos (if applicable), creator, and completion status. Completing a slip changes the copy status to Retired or Lost and removes it from availability without hard-deleting any records, preserving complete copy history. 

### **3.9 Receipt Management (Admin)**

Every monetary transaction in ShelfHelp automatically creates a record in a central Receipt table, so every payment can be traced to the activity that caused it. Receipts are generated for membership purchases, Premium per-book loan fees, overdue fines, damage and loss fees. Each receipt stores a unique receipt number, the student, the amount, the payment method (online gateway or counter), the transaction type, a reference link to the originating record (such as a membership purchase, loan, or Write-off Slip), the creator (the student, the librarian, or the system), and a timestamp. Refunds and corrections are recorded as separate reversal receipts that link back to the original, so the history of a payment is never overwritten.

Librarians can browse all receipts in a receipt log, filtered by date range, student, transaction type, payment method, and status (Valid, Voided, Reversed), and open any receipt to see its reference link and the activity that produced it. 

For cases the automated flows do not cover, librarians can create a manual receipt through a form similar to the Write-off Slip. The form requires the student, the amount, the payment method, a transaction type (e.g. replacement fee), a mandatory reason, an optional reference to the related loan or slip. These receipts are flagged explicitly as “manual” and record the librarian who created them.

### **3.10 Library Analytics and Reporting (Admin)** 

A dashboard shows the number of books on loan against total stock, overdue counts, fines collected, membership and Premium-loan revenue (computed via receipts in 3.9), and damaged, or lost books. It ranks the most and least borrowed titles over a selected time range, shows trends by category, and highlights demand signals such as grouped suggestions, long reservation queues, and Wishlist counts. Reports can be exported as CSV, PDF, or Excel with date and category filters, helping librarians prepare official reports and make purchasing and weeding decisions. Receipts cannot be edited or deleted after creation to preserve a complete audit trail of every monetary change.

## **4\. AI Feature: Research Book Recommendation Chatbot**

**Problem.** Keyword search works only when students already know the title or the right terminology. Students starting a thesis or assignment often know only their topic, e.g., "I am researching how deep learning is used to detect fraud in banking transactions, and I'm a beginner in machine learning." Keyword search on such a sentence returns poor results.

**Solution.** A chatbot understands such natural-language descriptions and recommends books actually held by the library, with a short explanation of why each matches.

**How it works (Retrieval-Augmented Generation).**

1. Each book's metadata (title, description, table of contents if available, category, reviewed keywords) is converted into an embedding vector and stored in a vector database. Books without a description are still embedded from their title, author, category, and tags, so no book is left out.  
2. When a student sends a request, the system embeds the query and retrieves the most semantically similar books, filtering by language, year, collection, and availability when the student asks for them.  
3. A large language model (via API) receives only these retrieved books as context and writes the answer: a ranked list of recommendations, a one-sentence reason for each, a suggested reading order (beginner to advanced), and follow-up questions to refine the request.  
4. Each recommendation links to the book detail page, shows availability and shelf location, and has an "Add to cart" button, so advice turns into borrowing in one click. If a relevant book is not in the catalog, the chatbot offers to submit a book suggestion request.


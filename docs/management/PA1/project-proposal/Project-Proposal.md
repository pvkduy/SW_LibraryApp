# **ShelfHelp: Smart Library Management System**

Performed by: Lê Văn Vĩ | Reviewed by: Nguyễn Anh Khôi | Edited by: Lê Văn Vĩ, Nguyễn Anh Khôi

---

## **1\. Introduction**

Many university libraries still run lending on spreadsheets, paper cards, or outdated systems. Students cannot easily see which books are available, forget due dates, and struggle to find reading material when all they have is a research topic rather than a title. Librarians spend their time on manual record keeping, chasing overdue books, tracking who has paid what, and compiling reports for the university.

**ShelfHelp** is a responsive web application that digitizes the whole lending cycle of a university library: discovering books, requesting a loan, picking the book up at the counter, tracking loans and fines, handling damaged or lost books, planning acquisition batches, and reporting on the collection. Because books are physical, a loan request made on the web becomes an active loan only when the student collects the book and the librarian confirms the handover; the system is built around this real-world constraint instead of pretending lending is purely online.

ShelfHelp also introduces a **membership model** (members borrow Premium materials free, non-members pay a small per-loan fee) that gives the library a sustainable income stream, and an **AI research assistant** that recommends books from the library's own catalog based on a student's natural-language description of their research.

**Value:**

* **For students:** faster discovery, transparent fees, automatic reminders that help them avoid fines, and personalized recommendations.  
* **For librarians:** accurate real-time inventory, automatic fee and fine calculation, a complete audit trail of every loan and status change, and one-click reports.  
* **For the institution:** less manual work, fewer lost and overdue books, a traceable disposal process that supports official reporting, and data-driven decisions about which books to buy or retire.

## **2\. Target Users and Environments**

**Student (Reader).** University students, identified by a university-issued account (student email) and student ID, who search for books, request and return loans, manage a membership, pay fees and fines, and give feedback. They mostly use smartphones between classes, for example to scan a book's barcode at a shelf or check a due date, and laptops when studying or writing a thesis.

**Librarian (Admin).** Library staff who manage the catalog and inventory, hand over and receive books at the counter, record payments made in person, review book suggestions and condition reports, plan acquisition batches, run disposal procedures, and generate reports. They mainly work on desktop computers at the library counter, with occasional tablet or phone use on the shelves.

**Environment.**

* Responsive web application on Windows, macOS, Android, and iOS.  
* Student pages are designed mobile-first, admin pages are designed desktop-first.  
* The device camera is used for avatar capture and for scanning book barcodes.

## **3\. Key Features** 

### **3.1 Account, Authentication**

Students register with their university email and student ID, verify their email, log in and out, and reset a forgotten password through an emailed link. Role-based access control separates student and librarian areas, so students can never reach admin functions. Thus, this protects personal borrowing data and ensures only authorized staff can change inventory or payments. 

### **3.2 Profile and Membership** 

Students edit their personal information (name, phone, faculty), change their password, and update their avatar by uploading an image or capturing one with the camera. These features enable students to manage their personal accounts conveniently while ensuring information accuracy and account security.

Besides, users can buy a membership plan for an academic year, see its status, expiry date, and the exact privileges. Plans are prepaid, one-time purchases renewed manually, with an email reminder about 7 days before expiry. Members borrow Premium titles for free, may hold more books at once, get longer loan periods and more renewals, and can reserve books that are currently unavailable. Non-members can still borrow Premium titles by paying a small per-book fee, and Standard books are free for everyone, maintaining the fundamental function of the library without the need of membership. 

### **3.3 Search, Browse, and Barcode Scan**

Students search for books by title, author, ISBN, or keyword, and refine results using filters such as category, field, publication year, language, and collection type (Standard or Premium), with sorting options based on relevance, recency, rating, or popularity. Browse views like new arrivals and top books display a paginated grid with key information, while detailed book pages provide descriptions, availability, shelf location, ratings, reviews, and a Wishlist button ("Notify me when available"). Students can also scan a book’s barcode using their phone camera to open its details instantly. These flexible discovery tools help students locate specific textbooks or explore relevant reading materials in seconds, eliminating time wasted wandering physical library stacks or searching with inaccurate catalog terms. 

### **3.4 Borrowing Cart, Reservations, and Payment**

Students add available books to a cart, choose the loan duration, and review the total fee. Free requests bypass the payment step and immediately become Ready for Pickup. Paid requests for Premium books by non-members start at Awaiting Payment until the per-book fee is settled through a simulated payment gateway or designated for counter payment. 

Members can reserve unavailable books through a limited queue. When a copy becomes available, it is held for the first member in the reservation queue with a pickup window and an automated notification is sent. If the hold expires without collection, the reservation is automatically cancelled and passed to the next member in queue, or released to general borrowing and Wishlist users if no queue remains. These features empower users with a seamless, flexible borrowing experience by simplifying checkout, giving members priority access to popular titles through smart reservation queues, and keeping them instantly informed with automated pickup alerts.

### **3.5 Loan Tracking, Ratings, Fines, and Reminders**

A "My Loans" page splits records into Ongoing and History and displays each request or loan's status. For ongoing borrowed loans, students can click a renew button to instantly extend the due date. After returning a book, a student can give a 1-5 star rating and a short review, which feeds the popularity and recommendation features. 

For overdue loans, the system automatically calculates a daily fine and displays the amount. Fines can be paid through the simulated online payment gateway or at the counter, but loans are closed only when books are physically returned and confirmed by a librarian. Unpaid fines and fees restrict students from starting new loan requests until settled. If a loan remains overdue past a critical threshold, it becomes considered as a Lost record and the student's account becomes restricted until they return the physical book and settle all associated fees. Therefore, users are required to take full responsibility for any damage caused to library resources.

The reminder system automatically notifies students about due dates, overdue loans, membership expiration, etc via both email and in-app notifications, ensuring students stay informed about their account status and return books on time to avoid unnecessary fines 

### **3.6 Book Suggestions and Acquisition Batches**

If a student cannot find a book, they submit a suggestion request with the title, author, ISBN or link, and a short reason. Similar requests are grouped automatically to show demand, and the librarian reviews the queue to approve or reject requests, notifying students of the outcome at each step. Approved book requests are accepted for purchase in the upcoming acquisition batch (e.g., "Semester 2, 2026"). The librarian builds the batch list by adding titles with requested quantities, which can be exported as CSV, PDF, or Excel for the procurement department. When books arrive, the librarian imports them against the batch, recording receipts, closing the batch, and notifying the students who requested them, keeping users informed with clear status updates, and ensuring high-demand books are efficiently acquired and promptly made available for borrowing.

### **3.7 Inventory and Circulation (Admin)**

Librarians add books one at a time or in bulk by importing a CSV list, and they edit metadata. Each physical copy has its own record with a barcode label, a status, and a shelf location that is shown to staff and students. Librarians can also see loans due or overdue grouped by day and week on a dedicated dashboard, with a "Remind all" button that sends bulk in-app notifications to affected students. These tools optimize daily library management workflow through automated systems.

The circulation view lists each loan with borrower name, student ID, borrow date, due date, and return date. To hand over a book, the librarian scans the book’s barcode to immediately locate the request, records its initial condition, and clicks to confirm the handover. To end a loan, the librarian also records the returned condition and charges any fee if applicable. A dedicated inventory history tracks every copy’s transactions in a single log, recording all information related to the transaction. The log is fully searchable by book and exportable as CSV, PDF, or Excel. These circulation capabilities speed up daily handover procedures and protect library assets by logging copy conditions and maintaining a fully searchable transaction history. 

### **3.8 Book Condition Tracking & Write-Off (Admin)**

To determine liability, the librarian must manually record the book's condition at handover and return (modify the related loan record). Confirmed missing, damage reports, and librarian-initiated removals for worn-out or obsolete books share a single flow built around a Write-Off Slip. The slip can cover multiple physical copies, recording the reason, evidence photos (if applicable), creator, and completion status. Completing a slip changes the copy status and removes it from availability. These tools ensure complete accountability and asset control by documenting physical book conditions during handovers and providing a photo-evidenced, transparent write-off process for lost, damaged, or obsolete inventory.

### **3.9 Receipt Management (Admin)**

Receipts are generated for monetary transactions like membership purchases, Premium per-book loan fees, overdue fines, damage and loss fees. Librarians can browse all receipts in a receipt log, filter, and open any receipt to see its reference link and the activity that produced it. For cases the automated flows do not cover, librarians can create a manual receipt through a form similar to the Write-off Slip. These receipts are flagged explicitly as “manual” and record the librarian who created them. This feature allows admin to keep track of currency circulation in one place conveniently. 

### **3.10 Library Analytics and Reporting (Admin)** 

A dashboard shows the number of books on loan against total stock, overdue counts, fines collected, membership and Premium-loan revenue, and damaged, or lost books. It ranks the most and least borrowed titles over a selected time range, shows trends by category, and highlights demand signals such as grouped suggestions, long reservation queues, and Wishlist counts. Reports can be exported as CSV, PDF, or Excel with date and category filters, helping librarians prepare official reports and make purchasing and weeding decisions.

## **4\. AI Feature: Research Book Recommendation Chatbot**

**Problem.** Keyword search works only when students already know the title or the right terminology. Students starting a thesis or assignment often know only their topic, e.g., "I am researching how deep learning is used to detect fraud in banking transactions, and I'm a beginner in machine learning." Keyword search on such a sentence returns poor results.

**Solution.** A chatbot understands such natural-language descriptions and recommends books actually held by the library, with a short explanation of why each matches.

**Mechanic: Retrieval-Augmented Generation**

1. Each book's metadata (title, description, table of contents if available, category, reviewed keywords) is converted into an embedding vector and stored in a vector database. Books without a description are still embedded from their title, author, category, and tags, so no book is left out.  
2. When a student sends a request, the system embeds the query and retrieves the most semantically similar books, filtering by language, year, collection, and availability when the student asks for them.  
3. A large language model (via API) receives only these retrieved books as context and writes the answer: a ranked list of recommendations, a one-sentence reason for each, a suggested reading order (beginner to advanced), and follow-up questions to refine the request.  
4. Each recommendation links to the book detail page, shows availability and shelf location, and has an "Add to cart" button, so advice turns into borrowing in one click. If a relevant book is not in the catalog, the chatbot offers to submit a book suggestion request.
# **SCRUM MEETING MINUTES**

*PA4: 16/11/2026 – 29/11/2026* 

Performed by: Nguyễn Anh Khôi

---

### **Date held: 20/11/2026**

### **Members present:**

- Nguyễn Anh Khôi  
- Lê Văn Vĩ  
- Lê Minh Thuận  
- Nguyễn Minh Phú  
- Phạm Võ Khang Duy

### **Members absent:**

None  
---

### **Status Reports**

#### **Nguyễn Anh Khôi**

	**Completed tasks**

1. **Task 1:**  
   Draft C4 architecture documentation: System Context, Container, Component (select and refactor features into key components to draw diagrams for), Deployment  
2. **Task 2:**  
   Create corresponding diagrams for each architecture level

   **To-do tasks**

1. **Task 1:**  
   Validate team implementation against use case and architecture documentation  
2. **Task 2:**  
   Update use case documentation after TA feedback

   **Issues and Obstacles**

1. **Issue 1:**  
   Mermaid lack of relationship routing makes diagrams too complicated and unreadable

   #### **Lê Văn Vĩ**

   	**Completed tasks**

1. **Task 1:**  
   Implement draft version for admin book page (database schema migration, UI draft)

   **To-do tasks**

1. **Task 1:**  
   Sync the UI with figma design  
2. **Task 2:**  
   Update certain functions where draft version not included

   **Issues and Obstacles**

1. **Issue 1:**

	The draft version for the admin book page includes numerous functions,  button,  
screen, thus it makes the whole structure difficult to manage.

#### **Lê Minh Thuận**

	**Completed tasks**

1. **Task 1:**  
   Review architecture documentation

   **To-do tasks**

1. **Task 1:**  
   Write source code for circulation screen and queues  
2. **Task 2:**  
   Fix bugs after enforcing backend caller checks and restricting mutation RPCs

   **Issues and Obstacles**

   None

   #### **Nguyễn Minh Phú**

   	**Completed tasks**

1. **Task 1:**  
   Draft source code for  Books \+ Catalog management/browsing features 

   **To-do tasks**

1. **Task 1:**  
   Fix bugs after enforcing backend caller checks and restricting mutation RPCs

   **Issues and Obstacles**

   None

   #### **Phạm Võ Khang Duy**

   	**Completed tasks**

1. **Task 1:**   
   Implemented loan lists and filters, item inspectors, handover and return actions, condition assessments, and photo evidence uploads.  
     
2. **Task 2:**   
   Implemented receipt and revenue tracking, outstanding charges, and transaction search and filters.

   **To-do tasks**

1. **Task 1:**   
   Test handover, returns, damaged-book assessment, and fee generation using local data.  
2. **Task 2:**   
   Confirm that payments made by Readers or Admin appear correctly in the Financial Ledger.

   **Issues and Obstacles**

1. **Issue 1:**  
   “Ready for pickup” items can be handed over; “Borrowed” and “Overdue” items can be returned. The UI was updated to reflect these status rules.  
2. **Issue 2:**  
   Photo evidence required dedicated storage and policies. Added the required configuration and migration, with a limit of three images at 10 MB each.

### ---

**Meeting Summary**

All five members were present. Khôi drafted the C4 architecture documentation (System Context, Container, Component, Deployment) with diagrams for each level, and will validate the team's implementation against the use case and architecture documentation and update the use cases after TA feedback. Vĩ implemented the draft admin book page (schema migration and UI draft) and will sync the UI with the Figma design and cover the functions the draft missed. Thuận reviewed the architecture documentation and will write the circulation screen and queues and fix bugs after the backend caller checks and restricted mutation RPCs. Phú drafted the Books and Catalog management/browsing features and will fix the same bugs. Duy implemented loan handling (lists, filters, handover, returns, condition assessments, photo evidence) and receipt and revenue tracking; he will test these flows with local data and confirm payments appear correctly in the Financial Ledger. Issues raised: Mermaid's weak relationship routing made diagrams hard to read, and the admin book page's many functions and screens made it hard to manage. Duy also updated the UI to match the status rules and added storage and policies for photo evidence. The next meeting is expected on 20/11/2026. 

### ---

### **Expected next SCRUM meeting: 27/11/2026**
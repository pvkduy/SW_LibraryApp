# **SPRINT REVIEW MEETING MINUTES**

*PA4: 16/11/2026 – 29/11/2026* 

Performed by: Nguyễn Anh Khôi

---

### **Date held: 28/11/2026**

### **Members present:**

- Nguyễn Anh Khôi  
- Lê Văn Vĩ  
- Lê Minh Thuận  
- Nguyễn Minh Phú  
- Phạm Võ Khang Duy

### **Members absent:**

None  
---

### **Sprint results** 

- **Sprint goal:** Revise the use-case model and specifications with Changes.md, write the software architecture document (tech stack, C4 System Context, Container and Component diagrams, Deployment diagram) in Mermaid, implement two more functional groups end-to-end with Spec Kit and record narrated demo videos, complete the AI Usage Report and Weekly Reports, and review and submit all deliverables.  
- **Other achievements:** Added the Reader-side loan, fine, renewal and review features and the Admin-side loan handling, receipt and revenue tracking. Enforced backend caller checks and restricted mutation RPCs. Added dedicated storage and policies for photo evidence.  
- **Goal met:** Yes  
- **Planned vs. completed tasks:** 12/12 from the final Jira board  
- **Deliverables:** Revised Use-Case Specification and Changes.md, Software Architecture document (tech stack, C4 Level 1, 2 and 3 diagrams, Deployment diagram), two functional groups implemented with Spec Kit (specs, plans, tasks and generated tests), demo video, AI Usage Report, Weekly Reports with Jira screenshots, Git log, meeting minutes.

### **What went well**

- The architecture documentation was drafted early, then reviewed by Thuận, and finished with all four levels (System Context, Container, Component, Deployment).  
- Khôi's diagram polish (relationship offsets, reordered declarations, diagrams split into parts) fixed the Mermaid readability problem raised in Scrum \#1.  
- The refined admin book page resolved the complexity issue raised in Scrum \#1.  
- Use-case changes were folded into the specifications, architecture documentation and Vision Document together, which addressed the PA3 lesson about keeping documents in sync.  
- Work was split by feature set (Reader and Admin), so each member owned a clear area and the demo videos could be recorded in parallel.  
- Every task had one performer and one reviewer, and all work was tracked on Jira.  
- All five members attended the planning, Scrum and review meetings.

### **What went wrong**

- Mermaid's weak relationship routing made the early diagrams too complicated to read, and it took a dedicated polish pass to fix.  
- The draft admin book page contained too many functions, buttons and screens, which made the structure hard to manage until it was refined.  
- Enforcing backend caller checks and restricting mutation RPCs broke existing features, so Thuận and Phú had to spend time fixing the resulting bugs.  
- Some work was only completed late in the sprint, such as the demo scripts and voiceover, the final BookCatalog code and the testing of the fine, renewal and review flows. This left little buffer for the final consistency check between the code and the architecture documents.

### **Lessons learned**

- Plan diagram structure early (split large diagrams into parts, set relationship offsets from the start) instead of fixing readability at the end.  
- Break large screens such as the admin book page into smaller modules from the beginning.  
- Announce security changes such as caller checks and restricted RPCs to the whole team, so that affected features are fixed together.  
- Verify the documented architecture against the source code before the final week, because any inconsistency is penalized.  
- Start the demo script and recording once each feature is stable, so they are not left to the last days.

### **Carry-over to next Sprint**

Review and refine the Spec Kit generated test cases (PA5), and keep the architecture and use-case documents updated as new features are implemented. 

### ---

### **Meeting Summary**

The team reviewed Sprint 4 (PA4) on 28/11/2026 with all five members present. The revised use-case specifications with Changes.md, the architecture document (tech stack, C4 Levels 1 to 3, Deployment diagram), two functional groups implemented with Spec Kit, the demo video, the AI Usage Report and the Weekly Reports were delivered. The main difficulties were Mermaid's weak relationship routing, the complexity of the admin book page, and the bug fixes needed after the backend caller checks were enforced. All three were resolved during the sprint through the diagram polish, the refined admin page and the bug fixes. For Sprint 5, the team will review and refine the generated tests, and keep the diagrams, specifications and Vision Document consistent with the implementation as new features are added. 
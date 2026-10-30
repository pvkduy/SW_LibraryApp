# **SPRINT REVIEW MEETING MINUTES**

*PA2: 19/10/2026 – 1/11/2026*   

Performed by: Nguyễn Anh Khôi

---

### **Date held: 31/10/2026**

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

- **Sprint goal:** Draft the initial Project Plan and Vision Document, set up Spec Kit in /src with constitution.md, have every member complete Spec Kit training, complete the AI Usage Report and Weekly Reports, and review and submit all deliverables.  
- **Other achievements:** migrated codebase to using Supabase backend services, updated README for setup and development guide   
- **Goal met:**Yes  
- **Planned vs. completed tasks:** 12/12 from final Jira board  
- **Deliverables:** Project Plan, Vision Document, Spec Kit setup with constitution.md, Spec Kit training evidence, AI Usage Report, Weekly Reports with Jira screenshots, Git log, meeting minutes.

### **What went well**

- Spec Kit was initialized in the repository and constitution.md was drafted early, then finalized after the backend change.  
- Every member completed the Spec Kit training by Scrum Meeting \#1.  
- The backend problem was caught early. Firebase’s paid-tier limits were raised at Scrum \#1, and by Scrum \#2 the Supabase project was set up and the codebase refactored.  
- The Project Plan was written, reviewed, and finalized against the provided template.  
- Vision Document sections 4 and 6 were drafted and the early sections written, with each document having a separate author and reviewer.  
- All five members attended the planning, Scrum, and review meetings.

### **What went wrong**

- The feature list and flows were still not settled at Scrum \#1, which blocked Vision Document section 5\. This is the same root cause as in Sprint 1\.  
- Moving from Firebase to Supabase forced a rework from a NoSQL to a relational data model late in the sprint.  
- Revisions since the original proposal made it hard to keep the Project Plan, Vision Document, and specification consistent.  
- Workload was identified to be uneven.   
- Risk management in the Project Plan cannot cover unforeseeable events in future sprints.

### **Lessons learned**

- Decide the main technology stack before drafting documents that depend on it, so a platform change doesn’t invalidate finished work.  
- Fix the feature list and main flows before writing the Vision Document, since later sections depend on them.  
- Agree on a schema migration workflow before several members start working against one shared database.  
- Update dependent documents in the same pass whenever scope or technology changes.  
- Spread setup and administrative tasks across members rather than concentrating them on the leader.

### **Carry-over to next Sprint**

Establish a schema migration workflow for the shared Supabase project.

### ---

### **Meeting Summary**

The team reviewed Sprint 2 (PA2) on 31/10/2026 with all five members present. The Project Plan, Vision Document, Spec Kit setup, and constitution.md were delivered, and every member completed the Spec Kit training. The main difficulties were the late migration from Firebase to Supabase,  keeping documents consistent after repeated revisions, and unresolved feature flows that delayed the Vision Document. For Sprint 3, the team will agree the scope and data model in detail during planning, set up a schema migration workflow for the shared database, rebalance tasks away from the team leader, and update all related documents together whenever scope changes.
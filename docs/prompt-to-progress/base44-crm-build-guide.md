# Build a Working CRM with Base44
**Prompt to Progress — Free build guide · 1 November 2026**

Learn how to build a working customer-enquiry tracker for a fictional UK business. This is a real code-built demo, not a promise that one prompt produces a finished production CRM. Use fictional test records only.


## WHAT YOU'LL BUILD

A basic mobile-friendly CRM for a fictional UK service business called Northside Services. It provides an enquiry inbox, a new-enquiry form, a search box, lead-status dropdowns and a four-card overview. The demo is built in Base44 with real stored records; it is not a static mock-up.


## WHAT THIS IS (AND IS NOT)

This is a proof-of-concept, not a production-ready customer management system. The demo does NOT include a live website form integration, automatic email notifications, appointment scheduling, consent workflows, customer messaging, or production-grade user onboarding. All customers shown are fictional, using example.com email addresses and dummy phone numbers.

The demonstration was implemented using Base44 app code and its data model, rather than by typing one unmodified prompt into the Base44 AI builder. The sample builder prompt below is a useful starting specification but has NOT yet been independently tested as a one-prompt build. Do not present it as a proven one-click result.


## STEP 1 — CREATE A DEMO APP

Open Base44 and start a new app, for example “Northside CRM Demo.” Use a fictional business name and do not upload real customer information while experimenting.


## STEP 2 — CREATE THE ENQUIRY DATA MODEL

Create an entity named Enquiry with fields:

- customer_name — text, required
- email — text
- phone — text
- service — text, required
- status — text / select, required; options New, Contacted, Quoted, Won, Lost
- notes — long text
- source — text, such as Website or Referral
Restrict permissions appropriately. In our demo the entity is limited to an admin account. Do not make real personal information publicly readable.


## STEP 3 — MAKE A DASHBOARD

Show four counters at the top: Total enquiries, New leads, Follow-ups (Contacted + Quoted), and Won. Below them show a searchable list with each customer's name, service, note and current status.


## STEP 4 — ADD A NEW-ENQUIRY FORM

Use an “Add enquiry” button to open a form with name, service, email, phone and notes. Save to the Enquiry entity. On success, close the form and refresh the list/counts. Validation should require name and service at a minimum.


## STEP 5 — ADD STATUS CHANGES AND SEARCH

Give each row a status dropdown. Changes must persist in the database, not just change the coloured badge on screen. Add a search that matches name, email, service, phone and notes, plus an optional status filter.


## STEP 6 — TEST USING FICTIONAL RECORDS

Try these completely fictional examples:

Jamie Taylor • Garden maintenance • New • jamie@example.com

Alex Morgan • Hedge trimming • Contacted • alex@example.com

Taylor Reid • Patio cleaning • Quoted • taylor@example.com

Checklist:

- [ ] The list loads with the records.
- [ ] Add a new fictional enquiry and confirm the count increases.
- [ ] Change Jamie Taylor from New to Quoted and confirm the update saved.
- [ ] Refresh the page and confirm the status is still Quoted.
- [ ] Search for “Patio” and find the right enquiry.
- [ ] Test the interface on a phone-size screen.
- [ ] Test that a visitor without permissions cannot see or modify private leads.

## STARTER PROMPT FRAMEWORK — test and customise


```text
Build a responsive customer enquiry CRM for a fictional UK gardening business called Northside Services. Use a clean, modern dashboard and a mobile-friendly layout. Store enquiries in a real Enquiry entity with customer name, email, phone, service, notes, source and status. Include a form to add enquiries, searchable lead list, status filtering and editable status choices New / Contacted / Quoted / Won / Lost. Display top-line counts for All, New, Follow-ups and Won. Save changes persistently, add clear success/error states and secure enquiries so only authorised users can access them. Use fictional demo data only. Do not claim an external website, calendar, notification or payment integration exists. After building, tell me exactly what you tested and what still needs manual testing.
```


## WHY THIS HELPS A SMALL BUSINESS

The first win is visibility: enquiries stop being scattered across notes, messages and spreadsheets. It does not by itself generate customers or guarantee extra sales. The value depends on using and maintaining the system consistently.


## HELPFUL REMINDERS

- Avoid putting real customer information into public demos.
- Before customer use, check data access, backups, GDPR responsibilities, user permissions and the business's own process.
- Prototype quality is not equivalent to production readiness.
- When adapting this starter prompt, independently verify each requested feature before promoting it as working.
Prompt to Progress — from prompts to something usable.


## What we actually tested

We created a Base44 Enquiry entity and a responsive dashboard with persisted records, new-enquiry form, search and editable status dropdown. We checked data read and a status update round trip using fictional records, and the screen recording shows the app in use. This was implemented through Base44 code tools, not one single AI-builder prompt. The prompt in this guide is a starting specification that you should verify and refine.

## Test-data reset

The demo also includes a delete enquiry button. Use that only to remove fictional records when restarting a demo.

## Using this guide

Copy the starter prompt into your own Base44 project, inspect what it produces, and run every test. Review data permissions and privacy before real-world use. This guide is free, without claims of guaranteed results or income. Comments on the Reel do not automatically trigger direct messages.

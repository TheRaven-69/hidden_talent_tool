# Screenshot capture notes

Captured on 5 November 2026 from the local Fynd Talent prototype at a 1440 × 1000 browser viewport. Screenshots show the existing interface; no application source code or CSS was changed for the captures. The written-answer image is a browser element screenshot.

| Image | Source and state |
|---|---|
| `browse-jobs.png` | Live catalog searched for Python; results read from the configured backend. |
| `post-job.png` | An unpublished draft using the existing Backendutvecklare (Python) demo description. The actual skill-suggestion endpoint supplied the suggestions. The draft was not published. |
| `apply-job.png` | The same job's application form, populated with the display name Demo Candidate and a contact-free excerpt of the existing demo profile. The draft was not submitted. |
| `assessment.png` | The real candidate assessment component with previously generated questions replayed through a temporary browser request interception. Stored answers/scores were omitted to display the answering state. No generation request reached the backend, and no answers were submitted. |
| `application-review.png` | Live overview of the existing completed demo application for Backendutvecklare (Python). Scores are the saved values, not adjusted for presentation. |
| `assessment-review.png` | The fourth question from that same completed assessment, including its saved written answer and model explanation. |

The demo uses fictional candidate material. Screenshots retain original Swedish content and English interface labels. They are interface illustrations, not evidence of assessment accuracy or a fresh end-to-end evaluation. The source CV header and contact details are not included in these captures.

The job-suggestion request may read/write the application's normal AI cache. No job, application or assessment was created or submitted for these captures. Browser request interception was removed after the candidate assessment capture.

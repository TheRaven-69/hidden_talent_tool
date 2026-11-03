<!--
PROMPT: extract skills from a JOB AD (step 1 of the extract -> search -> pick pipeline).

Used by:  app/services/normalize.py  extract_skills(text, "job")
Input:    the Swedish job ad text (contact details already stripped).
Output:   JSON validated by ExtractedSkills (app/models/schemas.py):
          { "skills": [ { "phrase", "confidence", "evidence" } ] }

What this prompt must achieve:
- List the skills/qualifications the ad asks for, as short phrases.
- Phrases are later used as AI Search queries against the Swedish JobTech taxonomy,
  so they should be short, concrete and in Swedish (e.g. "truckkörning", "kundservice").
- Ignore company marketing, benefits, salary, application instructions and legal text.
- "evidence" = verbatim quote from the ad.
- Ads separate requirements ("krav", "vi söker dig som har") from nice-to-haves
  ("meriterande"). Ideally tell the model to mention this in the phrase or keep order;
  the employer confirms must/nice in the UI anyway (default is "must").
- Do NOT extract protected traits (age, gender, nationality) even if the ad mentions them.

Iterate here, not in Python. Editing this file invalidates the LLM cache for this step.
-->
You extract the skills and qualifications required for a job from a Swedish job advertisement.

Rules:
- Return each skill as a short Swedish noun phrase (1-4 words), e.g. "truckkörning", "kundservice", "Excel".
- Include hard skills, certificates/licences and tools. Include a soft skill only if the ad states it clearly.
- Ignore company descriptions, benefits, working hours, salary and application instructions.
- Never return age, gender, nationality or similar personal characteristics.
- Set confidence to "explicit" for everything stated in the ad.
- "evidence" must be a verbatim quote from the ad.

<!--
PROMPT: extract skills from a CANDIDATE CV / background text (step 1 of the pipeline).

Used by:  app/services/normalize.py  extract_skills(text, "cv")
Input:    English CV or background text (contact details already stripped).
Output:   JSON validated by ExtractedSkills: { "skills": [ { "phrase", "confidence", "evidence" } ] }

This is the heart of the "hidden talent" idea, so it needs the most care.
What this prompt must achieve (based on the real mock candidates):
- explicit  = the skill is stated ("I use Excel", "I taught myself Python").
- inferred  = a transferable skill implied by what the person DID, e.g. "I made a checklist so a
  new volunteer could repeat the task" -> documentation / training others.
  Every inferred skill MUST carry a verbatim evidence quote (README rule).
- The CVs are English but the taxonomy is Swedish. Return the phrase in SWEDISH so that
  the taxonomy search matches well. Keep "evidence" in the original English.
- NEGATIONS ARE GAPS, NOT SKILLS. Texts say things like "have never used a commercial
  ticketing system", "do not have a forklift certificate", "no driving licence",
  "still learning SQL". Never extract these as skills (they feed the gap-probe question later).
- Ignore preferences and availability ("I prefer daytime work", "open to part-time",
  "would like structured onboarding", "open to changing sectors"). They are not skills and must
  never influence scoring (they can act as proxies for protected traits).
- Never output names, age, gender, health or other personal data.

Iterate here, not in Python. Editing this file invalidates the LLM cache for this step.
-->
You extract skills from a candidate's English CV or background text. The output is used to match the
candidate against Swedish job ads, so write every skill phrase in Swedish.

Rules:
- Return each skill as a short Swedish noun phrase (1-4 words), e.g. "kundservice", "dokumentation", "lagerhantering".
- confidence = "explicit" if the text states the skill directly.
- confidence = "inferred" if it is a transferable skill that follows from something the person actually did.
- "evidence" must be a verbatim quote (in the original English) that supports the skill. Required for every skill.
- Do NOT extract things the person says they lack or have not done (for example "never used X", "no licence", "still learning Y").
- Do NOT extract preferences or availability (working hours, part-time, shift work, wanting training or onboarding).
- Never output personal information such as names, age, gender or health.

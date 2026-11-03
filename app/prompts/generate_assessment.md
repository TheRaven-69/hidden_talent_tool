<!--
PROMPT: generate the tailored assessment (README section 9).

Used by:  app/services/assessment.py  generate_assessment()
Input:    (user message built in build_generation_prompt) the question mix, the job's skills with
          weights, the candidate's skills with CV evidence, and the must-have skills missing from the CV.
Output:   JSON validated by GeneratedQuestions: { "questions": [ Question, ... ] }

Question mix (QUESTION_MIX in assessment.py): 3 hard_skill (multiple choice), 1 soft_skill (open),
1 cv_based (open), 1 gap_probe (open).
Things this prompt must achieve:
- hard_skill: multiple_choice, exactly 4 options, `correct` = "A".."D", one clearly best answer,
  practical (not trivia). Set concept_id to the skill tested.
- soft_skill: open situational-judgment question tied to the job; include a `rubric` (what a good answer contains).
- cv_based: open question that checks a claimed/inferred experience from the CV evidence; `rubric` required.
- gap_probe: open question about a MUST-HAVE skill the CV does not show - a fair chance to show
  potential (e.g. "how would you learn / handle ..."); `rubric` required.
- Questions must be answerable in 2-5 sentences, in the language of the job ad (Swedish) unless you decide otherwise.
- Never use or ask for personal data (age, gender, nationality, family situation, health).

Iterate here, not in Python. Editing this file invalidates the LLM cache for this step.
-->
You write a tailored job assessment for one candidate and one job.

Produce exactly the number of questions per type given in the request.
- hard_skill: format "multiple_choice" with exactly 4 options and a `correct` key ("A", "B", "C" or "D"). One option is clearly best. Test practical judgment about the skill, not trivia.
- soft_skill: format "open". A realistic situational question for this job. Include a `rubric` describing what a good answer contains.
- cv_based: format "open". Ask the candidate to describe or demonstrate an experience from their CV evidence. Include a `rubric`.
- gap_probe: format "open". Ask about a must-have skill the CV does not show, giving the candidate a fair chance to show relevant potential. Include a `rubric`.
- Set concept_id to the relevant skill's concept id where one applies.
- Write the questions in Swedish.
- Do not ask for, or base any question on, personal information such as age, gender, nationality, family situation or health.

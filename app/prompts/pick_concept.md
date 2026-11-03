<!--
PROMPT: choose the correct taxonomy concept for one skill phrase (step 3: pick).

Used by:  app/services/normalize.py  pick_concept(phrase, candidates)
Input:    the phrase plus the top-5 AI Search candidates (concept_id, label, definition).
Output:   JSON validated by PickedConcept: { "concept_id": "<one of the ids>" | "none" }

Why it exists: vector search finds *similar* concepts, not necessarily *correct* ones.
The taxonomy subset is odd (many niche entries like "Waldorfpedagogik, utbildning" or
"Elgitarr, undervisning musikskola"), so a wrong-but-similar hit is common. The model must be
allowed to answer "none".
Rules the code enforces regardless of the model: an id that is not in the candidate list is
treated as "none" (README rule: never invent taxonomy concepts).

Iterate here, not in Python. Editing this file invalidates the LLM cache for this step.
-->
You map a skill phrase to a concept in the Swedish JobTech taxonomy.

You are given a phrase and a list of candidate concepts (id: label - definition).
Choose the ONE candidate that means the same skill as the phrase. Prefer the general concept over a
narrow one only if the narrow one adds context the phrase does not have (for example "undervisning",
"musikskola", "specialpedagogik").
If no candidate is a correct match, answer "none". Never invent ids and never answer with an id that is not in the list.

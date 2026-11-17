---
name: link-evidence
description: Link each claim of a loaded paper to the evidence that supports it, and submit it for checking. Use after finding the claims with find-claims.
---

# Linking claims to evidence

For every claim (sentence ID), in order:

1. Find the evidence in the paper:
   - for numbers and comparisons, the **table cells** that hold them: read the table with `review__get_table` and use cell IDs such as `T1.r4.c2`;
   - for qualitative support, the **sentences** that support the claim (results or analysis sections, not the claim itself): use `review__find_text` or `review__get_section`.
2. Use **only IDs returned by the read tools**. Never invent an ID, never cite a whole table (`T1`), and never cite the claim's own sentence.
3. Add `comparisons` **only if the claim sentence itself compares** the authors' method with a baseline ("outperforms", "better than", "on par with", "lower error than"). Each item is `{ours, baseline, higher_is_better}`: `ours` is the cell of the authors' method, `baseline` the cell of the method the claim names, in the same column. Set `higher_is_better` from the metric: false for error, loss, MAE, RMSE, FID, perplexity and columns marked ↓. Never add a comparison to a claim that does not compare anything: the code ignores it.
   - If the claim names several models, datasets or tasks ("on RoBERTa, DeBERTa, GPT-2 and GPT-3"), add **one comparison for each**, using the table for each. All of them must hold.
   - Cite result cells, never header cells (column names or settings such as "Batch Size").
4. For a claim without numbers (for example a theorem or a qualitative finding), cite the sentences where the paper states or shows it, such as the theorem or the result in a later section. Do not cite unrelated cells to make it look supported. If the paper contains nothing that supports the claim, submit it with no evidence: it will be labelled unsupported.
5. Give your own verdict in `model_label`: supported, unsupported, or unverified (you cannot tell).
6. Call `review__submit_link` once for the claim.
7. Read the result. If a check failed:
   - the reason may say "Elsewhere in the paper: 3 may be in S88". Read those sentences or cells (`review__get_section`, `review__get_table`) and, if they support the claim, submit the claim again with them;
   - otherwise search for the missing number or words with `review__find_text` before giving up;
   - evidence from earlier attempts is kept automatically: when you submit the claim again, add only the missing evidence;
   - if the paper really does not contain the evidence, accept the label. At most 3 attempts per claim.
8. Submit **every** claim, including those you think are unsupported or unverified.

When all claims are submitted, call `review__finish` once. Then give the user a short summary: how many claims are supported, unsupported and unverified, and the files written.

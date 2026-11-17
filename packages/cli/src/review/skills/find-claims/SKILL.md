---
name: find-claims
description: Find the main claims of a research paper loaded with review__load_paper. Use when asked to review a paper or list its claims.
---

# Finding the main claims

1. Read the abstract, the introduction and the conclusion with `review__get_section` (for example "abstract", "Introduction", "Conclusion"). Use the section names from the `review__load_paper` summary.
2. A main claim is a sentence in which the authors state what **their own** work shows or achieves:
   - in the abstract;
   - in the list of contributions in the introduction;
   - in the conclusion.
3. One claim per sentence. Use the sentence's ID (S12) as the claim's ID. Never rewrite or merge sentences.
4. A main claim is a **result**: what the authors found, measured, proved or achieved. For example:
   - numbers and comparisons: "reaches 85.3% accuracy", "outperforms X by 2 points", "reduces error by 30%";
   - proven results in a theory paper: "we prove that ...", "we derive sharp bounds on ...";
   - qualitative findings: "is robust to noise". These will be labelled unverified if no check applies; that is fine.
5. **Not** claims, even in the abstract or introduction:
   - definitions and background: what something is or measures ("The probability of necessity measures ...");
   - motivation and problem statements: why it is hard or important ("However, identifying X is challenging ...");
   - statements about other papers ("Prior work [cite] showed ...");
   - plans and structure ("We aim to ...", "In Section 3 we ...");
   - beliefs, hopes and speculation ("We believe ...", "We hope ...", "This may ...", future work);
   - sentences that only say what is proposed, without a result ("We propose a new definition of X"). Include such a sentence only if it also states a result.
   Test: if the sentence could be false because of the paper's own results, it is a claim. If not, skip it.
6. Aim for the 5 to 10 most important claims. If the same result is claimed in the abstract and the conclusion, take both sentences: they are separate claims.

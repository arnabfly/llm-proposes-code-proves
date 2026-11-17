# Benchmark summary

Created 2026-11-17T02:56:02.494Z. Valid versions: 77. Checks on: labels from code. Checks off: the model's own labels. Strict: no checks; the model's own label, with the task prompt telling it to apply the same rule as the code (evals/prompts/strict.md).
Each number is shown with k/n. A run where the target claim was not submitted counts as not Supported.
Development papers (paper1) are not in the headline numbers: the checks or the planting were tuned on them. They are reported apart below.

## Code version

- no Git commit: 693 runs
- **Warning:** 693 runs without a Git commit (the code version is unknown).

## Headline: benchmark papers

| Measure | Checks on | Checks off | Strict prompt, no checks |
|---|---|---|---|
| Runs | 231 | 231 | 231 |
| Versions | 77 | 77 | 77 |
| **RQ1: correctness** | | | |
| Precision of Supported | 52.4% (11/21) | 31.3% (72/230) | 37.6% (62/165) |
| Recall (clean runs Supported) | 15.3% (11/72) | 100.0% (72/72) | 86.1% (62/72) |
| False acceptance (faulty runs Supported) | 6.3% (10/159) | 99.4% (158/159) | 64.8% (103/159) |
| Fault detection, strict (Unsupported) | 44.0% (70/159) | 0.6% (1/159) | 32.1% (51/159) |
| Fault detection, lenient (not Supported) | 93.7% (149/159) | 0.6% (1/159) | 35.2% (56/159) |
| False alarm (clean runs Unsupported) | 15.3% (11/72) | 0.0% (0/72) | 12.5% (9/72) |
| **RQ2: consistency** | | | |
| Versions with the same label in all runs | 77.9% (60/77) | 98.7% (76/77) | 61.0% (47/77) |
| **RQ3: invented or wrong evidence** | | | |
| Submitted evidence IDs that do not exist | 0.1% (5/3632) | 0.4% (5/1141) | 0.3% (4/1214) |
| Model-"supported" links failing C1 to C4 | 22.9% (39/170) | 90.4% (208/230) | 94.5% (156/165) |
| Model-"supported" links the checks would not label Supported | 87.6% (149/170) | 98.7% (227/230) | 98.2% (162/165) |
| Faulty runs labelled Supported that the checks would have stopped | 0.0% (0/10) | 100.0% (158/158) | 100.0% (103/103) |
| ... failing C1 | 0.6% (1/170) | 1.3% (3/230) | 3.0% (5/165) |
| ... failing C2 | 8.8% (15/170) | 71.7% (165/230) | 77.0% (127/165) |
| ... failing C3 | 8.8% (15/170) | 24.8% (57/230) | 25.5% (42/165) |
| ... failing C4 | 4.7% (8/170) | 11.7% (27/230) | 10.3% (17/165) |
| **Also** | | | |
| Target not found | 0.4% (1/231) | 0.0% (0/231) | 0.0% (0/231) |
| Mean input tokens per run | 93134 (n=231) | 40102 (n=231) | 54011 (n=231) |
| Mean output tokens per run | 801 (n=231) | 435 (n=231) | 592 (n=231) |
| Mean seconds per run | 19.9 (n=231) | 9.9 (n=231) | 15.8 (n=231) |
| Mean steps per run | 11.7 (n=231) | 7.5 (n=231) | 9.0 (n=231) |

RQ4, by fault type. Clean: the share labelled Supported is the recall. Faults: strict = Unsupported, lenient = not Supported.

| Fault | Checks on: Supported | on: strict | on: lenient | Checks off: Supported | off: strict | off: lenient | Strict prompt, no checks: Supported | strict: strict | strict: lenient |
|---|---|---|---|---|---|---|---|---|---|
| clean | 15.3% (11/72) | 15.3% (11/72) | 84.7% (61/72) | 100.0% (72/72) | 0.0% (0/72) | 0.0% (0/72) | 86.1% (62/72) | 12.5% (9/72) | 13.9% (10/72) |
| F1 | 0.0% (0/42) | 19.0% (8/42) | 100.0% (42/42) | 97.6% (41/42) | 2.4% (1/42) | 2.4% (1/42) | 61.9% (26/42) | 33.3% (14/42) | 38.1% (16/42) |
| F2 | 9.7% (7/72) | 73.6% (53/72) | 90.3% (65/72) | 100.0% (72/72) | 0.0% (0/72) | 0.0% (0/72) | 69.4% (50/72) | 29.2% (21/72) | 30.6% (22/72) |
| F4 | 6.7% (3/45) | 20.0% (9/45) | 93.3% (42/45) | 100.0% (45/45) | 0.0% (0/45) | 0.0% (0/45) | 60.0% (27/45) | 35.6% (16/45) | 40.0% (18/45) |

## By paper

| Paper | Dev | Mode | Runs | Precision | Recall | False acceptance | Detection (lenient) | Not found |
|---|---|---|---|---|---|---|---|---|
| c2-routing | no | on | 24 | 0.0% (0/2) | 0.0% (0/9) | 13.3% (2/15) | 86.7% (13/15) | 0.0% (0/24) |
| davinci-prover | no | on | 12 | n/a (0/0) | 0.0% (0/6) | 0.0% (0/6) | 100.0% (6/6) | 0.0% (0/12) |
| divr | no | on | 24 | 100.0% (3/3) | 50.0% (3/6) | 0.0% (0/18) | 100.0% (18/18) | 0.0% (0/24) |
| fikiria | no | on | 30 | 100.0% (4/4) | 44.4% (4/9) | 0.0% (0/21) | 100.0% (21/21) | 3.3% (1/30) |
| hipfuse | no | on | 24 | n/a (0/0) | 0.0% (0/6) | 0.0% (0/18) | 100.0% (18/18) | 0.0% (0/24) |
| isharabart | no | on | 27 | 0.0% (0/2) | 0.0% (0/9) | 11.1% (2/18) | 88.9% (16/18) | 0.0% (0/27) |
| mape | no | on | 30 | 16.7% (1/6) | 11.1% (1/9) | 23.8% (5/21) | 76.2% (16/21) | 0.0% (0/30) |
| olifant | no | on | 24 | 0.0% (0/1) | 0.0% (0/9) | 6.7% (1/15) | 93.3% (14/15) | 0.0% (0/24) |
| peca | no | on | 36 | 100.0% (3/3) | 33.3% (3/9) | 0.0% (0/27) | 100.0% (27/27) | 0.0% (0/36) |
| c2-routing | no | off | 24 | 37.5% (9/24) | 100.0% (9/9) | 100.0% (15/15) | 0.0% (0/15) | 0.0% (0/24) |
| davinci-prover | no | off | 12 | 50.0% (6/12) | 100.0% (6/6) | 100.0% (6/6) | 0.0% (0/6) | 0.0% (0/12) |
| divr | no | off | 24 | 25.0% (6/24) | 100.0% (6/6) | 100.0% (18/18) | 0.0% (0/18) | 0.0% (0/24) |
| fikiria | no | off | 30 | 30.0% (9/30) | 100.0% (9/9) | 100.0% (21/21) | 0.0% (0/21) | 0.0% (0/30) |
| hipfuse | no | off | 24 | 25.0% (6/24) | 100.0% (6/6) | 100.0% (18/18) | 0.0% (0/18) | 0.0% (0/24) |
| isharabart | no | off | 27 | 33.3% (9/27) | 100.0% (9/9) | 100.0% (18/18) | 0.0% (0/18) | 0.0% (0/27) |
| mape | no | off | 30 | 30.0% (9/30) | 100.0% (9/9) | 100.0% (21/21) | 0.0% (0/21) | 0.0% (0/30) |
| olifant | no | off | 24 | 37.5% (9/24) | 100.0% (9/9) | 100.0% (15/15) | 0.0% (0/15) | 0.0% (0/24) |
| peca | no | off | 36 | 25.7% (9/35) | 100.0% (9/9) | 96.3% (26/27) | 3.7% (1/27) | 0.0% (0/36) |
| c2-routing | no | strict | 24 | 42.1% (8/19) | 88.9% (8/9) | 73.3% (11/15) | 26.7% (4/15) | 0.0% (0/24) |
| davinci-prover | no | strict | 12 | 50.0% (4/8) | 66.7% (4/6) | 66.7% (4/6) | 33.3% (2/6) | 0.0% (0/12) |
| divr | no | strict | 24 | 31.3% (5/16) | 83.3% (5/6) | 61.1% (11/18) | 38.9% (7/18) | 0.0% (0/24) |
| fikiria | no | strict | 30 | 34.6% (9/26) | 100.0% (9/9) | 81.0% (17/21) | 19.0% (4/21) | 0.0% (0/30) |
| hipfuse | no | strict | 24 | 33.3% (4/12) | 66.7% (4/6) | 44.4% (8/18) | 55.6% (10/18) | 0.0% (0/24) |
| isharabart | no | strict | 27 | 34.6% (9/26) | 100.0% (9/9) | 94.4% (17/18) | 5.6% (1/18) | 0.0% (0/27) |
| mape | no | strict | 30 | 28.0% (7/25) | 77.8% (7/9) | 85.7% (18/21) | 14.3% (3/21) | 0.0% (0/30) |
| olifant | no | strict | 24 | 35.0% (7/20) | 77.8% (7/9) | 86.7% (13/15) | 13.3% (2/15) | 0.0% (0/24) |
| peca | no | strict | 36 | 69.2% (9/13) | 100.0% (9/9) | 14.8% (4/27) | 85.2% (23/27) | 0.0% (0/36) |

## Failure analysis: clean claims not labelled Supported

Checks off and strict: the model's label, with the checks run afterwards on its link.

| Mode | Version | Run | Dev | Label | C2 reason | C3 reason |
|---|---|---|---|---|---|---|
| on | c2-routing__S10__clean | 1 | no | unverified | 0.77%: only in text (S224). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 36.53% is stated in S182 (only in text, not recomputed from a table); 42.36% is stated in S182 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | c2-routing__S10__clean | 2 | no | unverified | 0.77%: only in text (S224). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 36.53% is stated in S182 (only in text, not recomputed from a table); 42.36% is stated in S182 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | c2-routing__S10__clean | 3 | no | unverified | 0.77%: only in text (S224). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 36.53% is stated in S182 (only in text, not recomputed from a table); 42.36% is stated in S182 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | c2-routing__S247__clean | 1 | no | unverified | 1,024: only in text (S98); 36.53%: table cell T6.r17.c7; 42.36%: table cell T6.r17.c8; 99.23%: table cell T6.r17.c5. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | c2-routing__S247__clean | 2 | no | unverified | 1,024: only in text (S8); 36.53%: only in text (S182); 42.36%: only in text (S182); 99.23%: only in text (S182). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | c2-routing__S247__clean | 3 | no | unverified | 1,024: only in text (S8, S39, S98); 36.53%: only in text (S182); 42.36%: only in text (S182); 99.23%: only in text (S182). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | c2-routing__S52__clean | 1 | no | unverified | 18: only in text (S9, S41, S153). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | c2-routing__S52__clean | 2 | no | unverified | 18: only in text (S181). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | c2-routing__S52__clean | 3 | no | unverified | 18: only in text (S181). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | davinci-prover__S35__clean | 1 | no | unverified | 1: table cell T2.r17.c4; 13.7: only in text (S6). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | davinci-prover__S35__clean | 2 | no | unverified | 1: table cell T2.r17.c4; 13.7: only in text (S6). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | davinci-prover__S35__clean | 3 | no | unverified | 1: table cell T2.r17.c4; 13.7: only in text (S6). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | davinci-prover__S6__clean | 1 | no | unverified | 13.7: only in text (S35). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | davinci-prover__S6__clean | 2 | no | unsupported | 13.7 not found in the cited evidence (cited numbers: 92.6, 93.9, 51.1, 52.7, 32.3, 35.3, 93, 94.3, 53.8, 35.8, 36.1). Per number: 13.7: not found. Elsewhere in the paper: 13.7 is found only in text (S35); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| on | davinci-prover__S6__clean | 3 | no | unverified | 13.7: only in text (S35). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | divr__S18__clean | 1 | no | unverified | 0.838: only in text (S39); 0.685: only in text (S39). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | divr__S18__clean | 2 | no | unverified | 0.838: only in text (S39); 0.685: only in text (S39). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | divr__S18__clean | 3 | no | unverified | 0.838: only in text (S39); 0.685: only in text (S39). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | fikiria__S25__clean | 1 | no | unverified | 12.0: only in text (S158); 2.0: only in text (S159). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 6.4 = \|T1.r8.c5 - T1.r8.c6\| = 6.4. |
| on | fikiria__S25__clean | 2 | no | unverified | 12.0: only in text (S158); 2.0: only in text (S159). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 6.4 = \|T1.r8.c5 - T1.r8.c6\| = 6.4. |
| on | fikiria__S25__clean | 3 | no | unverified | 12.0: only in text (S158); 2.0: only in text (S159). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 6.4 = \|T1.r8.c5 - T1.r8.c6\| = 6.4. |
| on | fikiria__S5__clean | 1 | no | unsupported | 68.0%: table cell T1.r13.c4; 78.8%: table cell T1.r18.c4. |  |
| on | fikiria__S5__clean | 2 | no | unsupported | 68.0%: table cell T1.r13.c4; 78.8%: table cell T1.r18.c4. |  |
| on | hipfuse__S6__clean | 1 | no | unverified | 63.7%: table cell T3.r9.c23; 62.5%: table cell T2.r9.c28; 14.2: table cell T5.r14.c10; 22.4: table cell T5.r6.c10; 10: only in text (S222). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | hipfuse__S6__clean | 2 | no | unverified | 63.7%: only in text (S201); 62.5%: table cell T2.r9.c28; 14.2: table cell T5.r14.c10; 22.4: table cell T5.r6.c10; 10: only in text (S222). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | hipfuse__S6__clean | 3 | no | unverified | 63.7%: table cell T3.r9.c23; 62.5%: table cell T2.r9.c28; 14.2: table cell T5.r14.c10; 22.4: table cell T5.r6.c10; 10: only in text (S222). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | hipfuse__S8__clean | 1 | no | unsupported |  | 10.6%, 8.7 does not follow from the cited evidence (cited values: T8.r7.c4=3.71, T8.r3.c4=3.83, T8.r12.c4=1.74, T8.r9.c4=1.65, T10.r3.c3=57, T10.r6.c3=65.4). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | hipfuse__S8__clean | 2 | no | unsupported |  | 10.6%, 8.7 does not follow from the cited evidence (cited values: T8.r4.c4=3.48, T8.r7.c4=3.71, T8.r9.c4=1.65, T8.r12.c4=1.74, T10.r3.c3=57, T10.r6.c3=65.4, T8.r5.c4=3.77, T8.r10.c4=1.83). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | hipfuse__S8__clean | 3 | no | unsupported |  | 10.6%, 8.7 does not follow from the cited evidence (cited values: T8.r7.c4=3.71, T8.r12.c4=1.74, T8.r3.c4=3.83, T8.r4.c4=3.48, T8.r10.c4=1.83, T8.r11.c4=2.17, T8.r5.c4=3.77, T8.r6.c4=3.76, T8.r8.c4=2.44, T8.r9.c4=1.65, T10.r3.c3=57, T10.r6.c3=65.4). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | isharabart__S10__clean | 1 | no | unverified | 62.5: only in text (S317); 11.5: table cell T10.r5.c5. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 90.4% is stated in S316 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S10__clean | 2 | no | unverified | 62.5: only in text (S317); 11.5: table cell T10.r5.c5. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 90.4% is stated in S316 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S10__clean | 3 | no | unverified | 62.5: only in text (S317); 11.5: table cell T10.r5.c5. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 90.4% is stated in S316 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S11__clean | 1 | no | unverified | 28.0: table cell T11.r4.c4. | 99.3% is stated in S423 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S11__clean | 2 | no | unsupported | 28.0: table cell T11.r4.c4. | 99.3% is stated in S423 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S11__clean | 3 | no | unverified | 28.0: table cell T11.r4.c4. | 99.3% is stated in S423 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | isharabart__S9__clean | 1 | no | unverified | 51.7: table cell T6.r7.c9; 61.40: table cell T8.r13.c9; 10%: only in text (S25). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | isharabart__S9__clean | 2 | no | unverified | 51.7: table cell T6.r13.c9; 61.40: table cell T8.r13.c9; 10%: only in text (S25). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | isharabart__S9__clean | 3 | no | unverified | 51.7: table cell T6.r13.c9; 61.40: table cell T8.r13.c9; 10%: only in text (S25). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | mape__S29__clean | 1 | no | unverified | 12%: table cell T1.r8.c7; 35%: only in text (S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | mape__S29__clean | 3 | no | unverified | 12%: table cell T1.r10.c7; 35%: only in text (S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | mape__S3__clean | 1 | no | unverified | 12%: table cell T1.r10.c7; 35%: only in text (S29, S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | mape__S3__clean | 2 | no | unverified | 12%: table cell T1.r20.c7; 35%: only in text (S29, S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | mape__S3__clean | 3 | no | unsupported |  |  |
| on | mape__S41__clean | 1 | no | unverified | 90%: table cell T1.r8.c4. | 40% is stated in S149 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | mape__S41__clean | 2 | no | unverified | 90%: table cell T1.r8.c4. | 40% is stated in S149 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | mape__S41__clean | 3 | no | unverified | 90%: table cell T1.r8.c4. | 40% is stated in S149 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S187__clean | 1 | no | unverified |  | 2.43 is stated in S5 (only in text, not recomputed from a table); 2.51 is stated in S5 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S187__clean | 2 | no | unverified |  | 2.43 is stated in S5 (only in text, not recomputed from a table); 2.51 is stated in S5 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S187__clean | 3 | no | unverified |  | 2.43 is stated in S5 (only in text, not recomputed from a table); 2.51 is stated in S5 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S5__clean | 1 | no | unverified | 38.1%: table cell T6.r23.c2. | 2.43 is stated in S78 (only in text, not recomputed from a table); 2.51 is stated in S112 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S5__clean | 2 | no | unverified | 38.1%: table cell T6.r23.c2. | 2.43 is stated in S78 (only in text, not recomputed from a table); 2.51 is stated in S112 (only in text, not recomputed from a table). Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S5__clean | 3 | no | unverified | 38.1%: table cell T6.r23.c2. | 2.43 is stated in S78 (only in text, not recomputed from a table); 2.51 = T3.r23.c8 / T3.r3.c8 = 2.51. Text alone cannot make a claim Supported: every difference must be recomputed from cited table cells. |
| on | olifant__S6__clean | 1 | no | unsupported | 93: table cell T4.r21.c5; 100: only in text (S123, S189). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 14 does not follow from the cited evidence (cited values: T4.r9.c3=243, T4.r21.c5=93, T3.r21.c5=617, T3.r3.c3=1005). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | olifant__S6__clean | 2 | no | unsupported | 93: only in text (S123); 100: only in text (S119, S123, S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 10, 14 does not follow from the cited evidence (cited values: T4.r21.c8=1.09, T4.r19.c8=0.94, T4.r9.c3=243, T4.r9.c5=303, T3.r3.c3=1005, T3.r3.c5=1313). Elsewhere in the paper: 10 is found only in text (S53); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | olifant__S6__clean | 3 | no | unsupported | 93: table cell T4.r21.c5; 100: only in text (S119, S123, S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. | 14 does not follow from the cited evidence (cited values: T2.r7.c3=7.92, T2.r9.c3=5.4, T4.r5.c3=96, T4.r9.c3=243, T4.r21.c5=93). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| on | peca__S104__clean | 1 | no | unverified | 0.25: only in text (S144); 44.0%: table cell T1.r3.c6; 40.8%: table cell T1.r2.c6; 3.2: only in text (S144). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | peca__S104__clean | 2 | no | unverified | 0.25: only in text (S144); 44.0%: table cell T1.r3.c6; 40.8%: table cell T1.r2.c6; 3.2: only in text (S144). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | peca__S104__clean | 3 | no | unverified | 0.25: only in text (S144); 44.0%: table cell T1.r3.c6; 40.8%: table cell T1.r2.c6; 3.2: only in text (S144). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | peca__S33__clean | 1 | no | unverified | 0.25: only in text (S109, S111); 72.8%: table cell T1.r3.c3. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | peca__S33__clean | 2 | no | unverified | 0.25: only in text (S109, S111); 72.8%: table cell T1.r3.c3. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| on | peca__S33__clean | 3 | no | unverified | 0.25: only in text (S109, S111); 72.8%: table cell T1.r3.c3. Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| strict | c2-routing__S247__clean | 3 | no | unsupported | 1,024, 36.53%, 42.36%, 99.23% not found in the cited evidence (cited numbers: 36.47, 41.67, 37.81, 37.4, 44.1, 43.59). Per number: 1,024: not found; 36.53%: not found; 42.36%: not found; 99.23%: not found. Elsewhere in the paper: 1,024 may be in T1.r5.c1, T8.r7.c1, T16.r6.c1, T16.r16.c1 (also stated in text: S8, S39, S98); 36.53% may be in T3.r6.c5, T6.r17.c7 (also stated in text: S10, S182, S186); 42.36% may be in T6.r17.c8, T12.r18.c13, T20.r35.c7 (also stated in text: S10, S182); 99.23% may be in T6.r17.c5 (also stated in text: S182). Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| strict | davinci-prover__S35__clean | 3 | no | unsupported | 13.7 not found in the cited evidence (cited numbers: 91.8, 92.6, 93.9, 93, 94.3, 79.4). Per number: 1: table cell T2.r13.c4; 13.7: not found. Elsewhere in the paper: 13.7 is found only in text (S6); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| strict | davinci-prover__S6__clean | 1 | no | unsupported | 13.7 not found in the cited evidence (cited numbers: 92.6, 93.9, 51.1, 52.7, 22.3, 24.9). Per number: 13.7: not found. Elsewhere in the paper: 13.7 is found only in text (S35); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| strict | divr__S18__clean | 3 | no | unverified | 0.838: only in text (S39); 0.685: only in text (S39). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| strict | hipfuse__S6__clean | 2 | no | unsupported | 63.7%, 10 not found in the cited evidence (cited numbers: 22.4, 14.2, 62.5, 71.6). Per number: 63.7%: not found; 62.5%: table cell T2.r9.c28; 14.2: table cell T5.r14.c10; 22.4: table cell T5.r6.c10; 10: not found. Elsewhere in the paper: 63.7% may be in T3.r2.c13, T3.r9.c23, T7.r4.c3 (also stated in text: S201); 10 may be in T2.r4.c24, T2.r6.c15, T8.r8.c2, T8.r9.c2 (also stated in text: S178, S222, S246). Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| strict | hipfuse__S8__clean | 2 | no | unsupported |  | 10.6%, 8.7 does not follow from the cited evidence (cited values: T8.r3.c4=3.83, T8.r7.c4=3.71, T8.r8.c4=2.44, T8.r12.c4=1.74, T10.r3.c3=57, T10.r6.c3=65.4). Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| strict | mape__S29__clean | 2 | no | unsupported | 35% not found in the cited evidence (cited numbers: 70.01, 7.07, 81.33, 1.14). Per number: 12%: table cell T1.r13.c7; 35%: not found. Elsewhere in the paper: 35% may be in T2.r8.c3, T7.r8.c3, T11.r2.c4 (also stated in text: S3, S126). Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the cell or sentence that holds each number, or label the claim unsupported. |  |
| strict | mape__S3__clean | 2 | no | unsupported | 12%: table cell T1.r10.c7; 35%: only in text (S126). Text alone cannot make a claim Supported: every number must be in a cited table cell. Cite the table cell that holds each number, if the paper has one. |  |
| strict | olifant__S187__clean | 1 | no | unsupported |  | 2.43, 2.51 does not follow from the cited evidence (fewer than two cited cells hold numbers, and no cited sentence states or computes it). Elsewhere in the paper: 2.43 is found only in text (S5, S78, S82); text alone cannot make a claim Supported; 2.51 is found only in text (S5, S112); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |
| strict | olifant__S187__clean | 2 | no | unsupported |  | 2.43, 2.51 does not follow from the cited evidence (fewer than two cited cells hold numbers, and no cited sentence states or computes it). Elsewhere in the paper: 2.43 is found only in text (S5, S78, S82); text alone cannot make a claim Supported; 2.51 is found only in text (S5, S112); text alone cannot make a claim Supported. Read them (review__get_section accepts sentence IDs, review__get_table the table) and cite the right one. Cite the two cells that give this difference, or the sentence where the paper computes it, or label the claim unsupported. |

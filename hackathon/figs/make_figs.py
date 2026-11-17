import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.ticker import FuncFormatter
# Same font as the report: Latin Modern via LaTeX
matplotlib.use("pgf")
plt.rcParams.update({"pgf.texsystem": "pdflatex", "pgf.rcfonts": False,
    "pgf.preamble": r"\usepackage[T1]{fontenc}\usepackage{lmodern}",
    "font.family": "serif", "font.size": 9})
INK="#2b2b28"; MUTED="#6b6a63"; GRID="#e6e5e0"
C_ON, C_OFF, C_STRICT = "#2a78d6", "#eb6834", "#1baf7a"
TW = 6.3   # report text width in inches (A4, 2.5 cm margins)
pct = FuncFormatter(lambda v, _: rf"{v:.0f}\%")

# ---------- Figure 1 ----------
fig, ax = plt.subplots(figsize=(6.1, 2.15)); fig.subplots_adjust(0,0,1,1); ax.set_xlim(-0.5,101); ax.set_ylim(0,35); ax.axis("off")
texts=[]
def box(x,w,title,lines,fc,y=8,h=26):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.3,rounding_size=1.5",fc=fc,ec="#b9b8b0",lw=0.8))
    t1=ax.text(x+w/2,y+h-1.8,rf"\textbf{{{title}}}",ha="center",va="top",fontsize=9,color=INK)
    t2=ax.text(x+w/2,y+h-7.2,"\n".join(lines),ha="center",va="top",fontsize=8,color=INK,linespacing=1.35)
    texts.append(((x,y,w,h),[t1,t2]))
specs=[(0.5,14,"Paper",["\\LaTeX{} source","(the author's","own, before","submission)"],"#f4f3ef"),
       (18,19,"1. Parse",["\\textit{code}","sentences:","S1, S2, \\ldots","table cells:","T2.r13.c13","with row and","column labels"],"#f4f3ef"),
       (40.5,18,"2. Propose",["\\textit{LLM}","finds the claim","and cites its","evidence by ID"],"#fdf0e9"),
       (62,20,"3. Check",["\\textit{code}","C1 evidence exists","C2 numbers in","cited table cells","C3 differences","C4 direction"],"#e9f1fb"),
       (85.5,14.5,"4. Label",["\\textit{code}","Supported","Unsupported","Unverified","+ reasons"],"#e9f1fb")]
for s in specs: box(*s)
for a,b in zip(specs,specs[1:]):
    ax.add_patch(FancyArrowPatch((a[0]+a[1]+0.7,21),(b[0]-0.7,21),arrowstyle="-|>",mutation_scale=9,color=MUTED,lw=1))
ax.add_patch(FancyArrowPatch((72,7.2),(49.5,7.2),arrowstyle="-|>",mutation_scale=9,color=MUTED,lw=1,connectionstyle="arc3,rad=-0.35"))
ax.text(61,0.8,r"\textit{if a check fails, the model is given the reason and may resubmit}",ha="center",fontsize=7.5,color=MUTED)
fig.savefig("figs/fig1-method.pdf",bbox_inches="tight",facecolor="white"); plt.close(fig)

# ---------- Figure 2 ----------
groups=[("Unchanged","(should be Supported)",72),("F1 changed","table value",42),("F2 changed","claim number",72),("F4 removed","table value",45)]
on=[11/72,0/42,7/72,3/45]; off=[72/72,41/42,72/72,45/45]; strict=[62/72,26/42,50/72,27/45]
fig, ax = plt.subplots(figsize=(TW, 3.0)); w=0.26
for i,(name,vals,c) in enumerate([("LLM alone",off,C_OFF),("Strict instructions",strict,C_STRICT),("LLM with checks",on,C_ON)]):
    pos=[x+(i-1)*(w+0.02) for x in range(4)]
    ax.bar(pos,[v*100 for v in vals],width=w,color=c,label=name,edgecolor="white",linewidth=1.2)
    for p,v in zip(pos,vals): ax.text(p,v*100+1.5,rf"{v*100:.0f}\%",ha="center",va="bottom",fontsize=7.5,color=INK)
ax.axvline(0.5,color="#b9b8b0",lw=0.8,ls=(0,(3,3)))
ax.text(0.54,106,"versions with an introduced error (should not be Supported)",fontsize=7.5,color=MUTED,va="bottom")
ax.set_ylim(0,115); ax.set_yticks([0,25,50,75,100]); ax.yaxis.set_major_formatter(pct)
ax.set_ylabel("Runs labelled Supported")
ax.set_xticks(range(4)); ax.set_xticklabels([f"{a}\n{b}\n($n={n}$)" for a,b,n in groups],fontsize=8)
for s in ["top","right","left"]: ax.spines[s].set_visible(False)
ax.spines["bottom"].set_color("#b9b8b0"); ax.yaxis.grid(True,color=GRID,lw=0.6); ax.set_axisbelow(True)
ax.tick_params(length=0); ax.tick_params(axis="y",labelcolor=MUTED)
ax.legend(frameon=False,loc="upper center",bbox_to_anchor=(0.5,-0.3),ncol=3,fontsize=8)
fig.savefig("figs/fig2-by-fault.pdf",bbox_inches="tight",facecolor="white"); plt.close(fig)

# ---------- Figure 3 ----------
fig, ax = plt.subplots(figsize=(3.9, 3.1))
for name,fa,rc,c,off_,ha in [("LLM alone",99.4,100.0,C_OFF,(-8,9),"right"),("Strict instructions",64.8,86.1,C_STRICT,(7,-4),"left"),("LLM with checks",6.3,15.3,C_ON,(7,5),"left")]:
    ax.scatter([fa],[rc],s=55,color=c,edgecolor="white",linewidth=1.5,zorder=3)
    ax.annotate(rf"{name}" + "\n" + rf"(false acc.\ {fa}\%, recall {rc}\%)",(fa,rc),xytext=off_,textcoords="offset points",ha=ha,va="center",fontsize=7.5,color=INK)
ax.set_xlim(-5,108); ax.set_ylim(-5,122); ax.set_yticks([0,20,40,60,80,100])
ax.set_xlabel("False acceptance (introduced errors)"); ax.set_ylabel("Recall (unchanged versions)")
ax.xaxis.set_major_formatter(pct); ax.yaxis.set_major_formatter(pct)
for s in ["top","right"]: ax.spines[s].set_visible(False)
for s in ["left","bottom"]: ax.spines[s].set_color("#b9b8b0")
ax.grid(True,color=GRID,lw=0.6); ax.set_axisbelow(True); ax.tick_params(length=0,labelcolor=MUTED,labelsize=8)
ax.text(1,115,r"\textit{best position: top left}",fontsize=7.5,color=MUTED)
fig.savefig("figs/fig3-tradeoff.pdf",bbox_inches="tight",facecolor="white"); plt.close(fig)
print("done")

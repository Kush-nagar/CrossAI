// Real past/current PF resolutions — the drill is Public Forum only, so this
// bank holds only PF topics. Scoped to the 2024-25 season onward (topics prior
// to 2024 were removed); older seasons and the LD/Policy banks are gone.
// Shape: { season, when (null for yearlong/unknown), text }.

export type DrillTopic = { season: string; when: string | null; text: string }

export const DRILL_TOPICS: Record<string, DrillTopic[]> = {
  "Public Forum": [
    { season: "2025-26", when: "Nationals", text: "Resolved: The United States is justified in using force to remove authoritarian leaders from power." },
    { season: "2025-26", when: "April", text: "Resolved: The United States should eliminate the President's authority to deploy military forces abroad without Congressional approval." },
    { season: "2025-26", when: "March", text: "Resolved: The United States federal government should ban corporate acquisition of single-family residences." },
    { season: "2025-26", when: "February", text: "Resolved: The Federal Trade Commission should establish a federal regulatory framework for sports betting." },
    { season: "2025-26", when: "January", text: "Resolved: The People's Republic of China should substantially reduce its international extraction of natural resources." },
    { season: "2025-26", when: "November/December", text: "Resolved: The United States federal government should require technology companies to provide lawful access to encrypted communications." },
    { season: "2025-26", when: "September/October", text: "Resolved: The United Kingdom should rejoin the European Union." },
    { season: "2024-25", when: "Nationals", text: "Resolved: On balance, in the United States, the benefits of presidential executive orders outweigh the harms." },
    { season: "2024-25", when: "April", text: "Resolved: The United States federal government should substantially increase its investment in domestic nuclear energy." },
    { season: "2024-25", when: "March", text: "Resolved: In the United States, the benefits of the use of generative artificial intelligence in education outweigh the harms." },
    { season: "2024-25", when: "February", text: "Resolved: The United States should accede to the Rome Statute of the International Criminal Court." },
    { season: "2024-25", when: "January", text: "Resolved: The African Union should grant diplomatic recognition to the Republic of Somaliland as an independent state." },
    { season: "2024-25", when: "November/December", text: "Resolved: The United States should substantially reduce its military support of Taiwan." },
    { season: "2024-25", when: "September/October", text: "Resolved: The United States federal government should substantially expand its surveillance infrastructure along its southern border." },
  ],
}

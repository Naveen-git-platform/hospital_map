/**
 * Field-survey notes per constituency. Not rendered directly; included in the
 * constituency search index so queries like "basti" or "closed" find the seat.
 */
export interface SurveyNote {
  day: number;
  sqkm: number;
  areas?: string;
  govt: number;
  private: string;
  basti: number;
  gap?: string;
  finding: string;
}

export const survey: Record<string, SurveyNote> = {
  nampally: {
    day: 1,
    sqkm: 10,
    govt: 4,
    private: "16",
    basti: 13,
    finding:
      "The note gave counts only — no hospital was named. On the ground this colour holds Niloufer and MNJ at Red Hills. Masab Tank, Public Garden and the Mehdipatnam edge are the places to search.",
  },
  karwan: {
    day: 2,
    sqkm: 15,
    areas: "39 areas",
    govt: 1,
    private: "7",
    basti: 9,
    finding:
      "Government anchor is the Area Hospital at Golconda, about 200 beds. Dharani is the private hospital named in the note. Tolichowki–Mehdipatnam flyovers are an access project, not a new hospital.",
  },
  goshamahal: {
    day: 3,
    sqkm: 7,
    areas: "43 areas",
    govt: 1,
    private: "—",
    basti: 0,
    finding:
      "The healthcare project in the old-city half of the survey: a new Osmania complex, ₹2,700 crore, 2,000 beds, still a site, aimed at 9 Dec 2027, placed here at Goshamahal / Malakunta. Same deadline as TIMS LB Nagar, TIMS Alwal and the Warangal tower. King Koti district hospital also sits in this colour.",
  },
  charminar: {
    day: 4,
    sqkm: 8,
    areas: "44 areas",
    govt: 1,
    private: "8–10",
    basti: 0,
    gap: "Charminar Government Hospital is marked closed — zero budget, in the survey.",
    finding:
      "The closure is the finding. Nizamia General Hospital, 180 beds, Unani and general, is the operational government hospital a short walk from the monument. On this simplified boundary Nizamia’s gate falls in the Yakutpura colour.",
  },
  chandrayangutta: {
    day: 5,
    sqkm: 8,
    areas: "~40 neighbourhoods",
    govt: 3,
    private: "50–60",
    basti: 16,
    finding:
      "Highest private density in the old city, and 16 Basti Dawakhanas — the most in the survey. No private campus was named. Barkas, the Yemeni neighbourhood, is the place the note points to. Owaisi at Kanchanbagh is the large hospital this side actually uses.",
  },
  yakutpura: {
    day: 6,
    sqkm: 15,
    govt: 0,
    private: "14",
    basti: 12,
    gap: "The only surveyed seat with no major government hospital.",
    finding:
      "Twelve Basti Dawakhanas and 14 private hospitals. Apna Multispeciality at Santosh Nagar is the only private name in the note. Owaisi, just south, is a teaching hospital — it does not fill the government gap the survey counted.",
  },
  bahadurpura: {
    day: 7,
    sqkm: 15,
    areas: "23 areas",
    govt: 1,
    private: "6",
    basti: 9,
    finding:
      "The new public bed in the old city, apart from the Osmania project: a 100-bed government hospital at Falaknuma, by the zoo park, inside a ₹62 crore works package.",
  },
  malakpet: {
    day: 8,
    sqkm: 9,
    areas: "26 areas",
    govt: 1,
    private: "15",
    basti: 13,
    finding:
      "M.N. Area Hospital is the government anchor. Yashoda Malakpet is the private campus next to it — one of the three Yashoda hospitals in the current leading set.",
  },
  amberpet: {
    day: 9,
    sqkm: 12,
    areas: "17 areas",
    govt: 1,
    private: "19",
    basti: 9,
    finding:
      "One government hospital, unnamed in the note, and the second-highest private count after Chandrayangutta. Fever Hospital at Nallakunta is the public campus this colour actually contains. DD Colony is the high-value pocket; the flyover is a road project, not a ward.",
  },
  musheerabad: {
    day: 10,
    sqkm: 11,
    areas: "17 areas",
    govt: 1,
    private: "9",
    basti: 7,
    finding:
      "Gandhi is the largest public hospital in the survey, and the note places it here. On this map the campus sits just across the line, in the Sanathnagar colour. Pulse, on CRPF Road, is the private hospital named in the note — that pin falls the same way.",
  },
  secunderabad: {
    day: 11,
    sqkm: 9,
    areas: "25 areas",
    govt: 2,
    private: "5",
    basti: 10,
    finding:
      "Two government hospitals and ten Basti Dawakhanas. The note did not name the government campuses. The Clock Tower hospitals — Yashoda, KIMS, Sunshine — fall in the cantonment colour next door. Tarnaka and Mettuguda are the metro access.",
  },
  "secunderabad-cantonment": {
    day: 12,
    sqkm: 17,
    areas: "59 areas",
    govt: 1,
    private: "—",
    basti: 6,
    gap: "One government hospital for 59 areas. The survey did not name it.",
    finding:
      "Second-highest area count after Khairatabad, and most of it inside the cantonment board. Navodaya, at Paradise, is the private campus named in the note. Yashoda Secunderabad, in this same colour, is the leading private hospital for the north.",
  },
  sanathnagar: {
    day: 13,
    sqkm: 20,
    areas: "27 areas",
    govt: 4,
    private: "7",
    basti: 15,
    finding:
      "Largest seat in the survey, 20 sq km, and the seat that holds the open TIMS. MCR TIMS — 1,082 beds, inaugurated 17 August 2026, about 600 outpatients a day by 22 October, surgery still phased — is the new government anchor, with ESIC and its new OPD block beside it. This simplified map paints Begumpet and Gandhi as Sanathnagar, and paints the real Sanathnagar–Erragadda stretch as Jubilee Hills. The TIMS pin is the Chest Hospital campus on the metro side.",
  },
  khairatabad: {
    day: 14,
    sqkm: 10,
    areas: "125 areas",
    govt: 1,
    private: "22",
    basti: 5,
    finding:
      "Densest seat by neighbourhood count. One government hospital: NIMS at Punjagutta, with an expansion of about 2,020 beds underway. The survey treats Jubilee Hills, Film Nagar and Banjara Hills as part of this seat — Apollo Jubilee Hills, Yashoda Somajiguda, Virinchi and a NOVA ENT campus. This map splits a Jubilee Hills colour off the west side, so Apollo stays in this colour and Aster at Ameerpet does not.",
  },
};

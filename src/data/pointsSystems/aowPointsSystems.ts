import type { PointsSystem } from '../../types/gameTypes';

export const aowPointsSystems: Record<string, PointsSystem> = {
  "pts-nascar-1990": {
    id: "pts-nascar-1990",
    name: "NASCAR 1990 Winston Cup (175-170-165...)",
    pointsByPosition: {
      1: 175, 2: 170, 3: 165, 4: 160, 5: 155, 6: 150, 7: 146, 8: 142, 9: 138, 10: 134,
      11: 130, 12: 127, 13: 124, 14: 121, 15: 118, 16: 115, 17: 112, 18: 109, 19: 106, 20: 103,
      21: 100, 22: 97, 23: 94, 24: 91, 25: 88, 26: 85, 27: 82, 28: 79, 29: 76, 30: 73,
      31: 70, 32: 67, 33: 64, 34: 61, 35: 58, 36: 55, 37: 52, 38: 49, 39: 46, 40: 43,
      41: 40, 42: 37, 43: 34, 44: 31, 45: 28, 46: 25, 47: 20, 48: 15, 49: 10, 50: 8,
      51: 6, 52: 4, 53: 2, 54: 1,
    },
    bonusNotes: "Latford full-season points. Base points 175-170-165-160-155-150, then 146-142-138-134-130, then descending by 3 through 43rd, then 31-28-25-20-15-10-8-6-4-2-1 for positions 44-54. Bonus: leading a lap +5; leading most laps +5.",
  },
  "pts-nascar-2000": {
    id: "pts-nascar-2000",
    name: "NASCAR 2000 Winston Cup (175-170-165...)",
    pointsByPosition: {
      1: 175, 2: 170, 3: 165, 4: 160, 5: 155, 6: 150, 7: 146, 8: 142, 9: 138, 10: 134,
      11: 130, 12: 127, 13: 124, 14: 121, 15: 118, 16: 115, 17: 112, 18: 109, 19: 106, 20: 103,
      21: 100, 22: 97, 23: 94, 24: 91, 25: 88, 26: 85, 27: 82, 28: 79, 29: 76, 30: 73,
      31: 70, 32: 67, 33: 64, 34: 61, 35: 58, 36: 55, 37: 52, 38: 49, 39: 46, 40: 43,
      41: 40, 42: 37, 43: 34, 44: 31, 45: 28, 46: 25, 47: 20, 48: 15, 49: 10, 50: 8,
      51: 6, 52: 4, 53: 2, 54: 1,
    },
    bonusNotes: "Latford full-season points. Base points 175-170-165-160-155-150, then 146-142-138-134-130, then descending by 3 through 43rd, then 31-28-25-20-15-10-8-6-4-2-1 for positions 44-54. Bonus: leading a lap +5; leading most laps +5.",
  },
  "pts-nascar-2010": {
    id: "pts-nascar-2010",
    name: "NASCAR 2010 Sprint Cup (185-170-165...)",
    pointsByPosition: {
      1: 185, 2: 170, 3: 165, 4: 160, 5: 155, 6: 150, 7: 146, 8: 142, 9: 138, 10: 134,
      11: 130, 12: 127, 13: 124, 14: 121, 15: 118, 16: 115, 17: 112, 18: 109, 19: 106, 20: 103,
      21: 100, 22: 97, 23: 94, 24: 91, 25: 88, 26: 85, 27: 82, 28: 79, 29: 76, 30: 73,
      31: 70, 32: 67, 33: 64, 34: 61, 35: 58, 36: 55, 37: 52, 38: 49, 39: 46, 40: 43,
      41: 40, 42: 37, 43: 34, 44: 31, 45: 28, 46: 25, 47: 20, 48: 15, 49: 10, 50: 8,
      51: 6, 52: 4, 53: 2, 54: 1,
    },
    bonusNotes: "Latford race points with 185 to win. 12-driver, 10-race Chase after 26 races with reset totals seeded by regular-season wins. Bonus: leading a lap +5; leading most laps +5.",
  },
  "pts-nascar-2026": {
    id: "pts-nascar-2026",
    name: "NASCAR 2026 Cup Series (55-35-34...)",
    pointsByPosition: {
      1: 55, 2: 35, 3: 34, 4: 33, 5: 32, 6: 31, 7: 30, 8: 29, 9: 28, 10: 27,
      11: 26, 12: 25, 13: 24, 14: 23, 15: 22, 16: 21, 17: 20, 18: 19, 19: 18, 20: 17,
      21: 16, 22: 15, 23: 14, 24: 13, 25: 12, 26: 11, 27: 10, 28: 9, 29: 8, 30: 7,
      31: 6, 32: 5, 33: 4, 34: 3, 35: 2, 36: 1, 37: 1, 38: 1, 39: 1, 40: 1,
    },
    bonusNotes: "2026 points system. 55 points to win, then 35-34-33... down to 1 point for positions 36-40. Stage points 10-9-8-7-6-5-4-3-2-1 awarded at the end of each stage. Daytona Duel top 10 also score 10-9-...-1. No bankable playoff points; 16-driver, 10-race points-based Chase with seeded totals.",
  },
  "pts-cart-1990-2001": {
    id: "pts-cart-1990-2001",
    name: "CART 1990-2001 (20-16-14...)",
    pointsByPosition: { 1: 20, 2: 16, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 },
    bonusNotes: "Top 12 score 20-16-14-12-10-8-6-5-4-3-2-1. Bonus: pole position +1; most laps led +1. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems; https://www.champcarstats.com/points.htm",
  },
  "pts-cart-2002-2003": {
    id: "pts-cart-2002-2003",
    name: "CART 2002-2003 (CART base + qualifying group bonus)",
    pointsByPosition: { 1: 20, 2: 16, 3: 14, 4: 12, 5: 10, 6: 8, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 },
    bonusNotes: "Top 12 score as CART 1983-2003. Bonus: pole position +1; most laps led +1; leading slowest qualifying group +1. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems; https://www.champcarstats.com/points.htm",
  },
  "pts-champcar-2004-2006": {
    id: "pts-champcar-2004-2006",
    name: "Champ Car 2004-2006 (31-27-25...)",
    pointsByPosition: { 1: 31, 2: 27, 3: 25, 4: 23, 5: 21, 6: 19, 7: 17, 8: 15, 9: 13, 10: 11, 11: 10, 12: 9, 13: 8, 14: 7, 15: 6, 16: 5, 17: 4, 18: 3, 19: 2, 20: 1 },
    bonusNotes: "Top 20 score 31-27-25-23-21-19-17-15-13-11-10-9-8-7-6-5-4-3-2-1. Bonus: leading a lap +1; fastest race lap +1; most positions improved +1; leading slowest qualifying group +1; pole/final qualification bonus per source table. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems; https://www.champcarstats.com/points.htm",
  },
  "pts-champcar-2007": {
    id: "pts-champcar-2007",
    name: "Champ Car 2007 (31-27-25... revised bonus)",
    pointsByPosition: { 1: 31, 2: 27, 3: 25, 4: 23, 5: 21, 6: 19, 7: 17, 8: 15, 9: 13, 10: 11, 11: 10, 12: 9, 13: 8, 14: 7, 15: 6, 16: 5, 17: 4, 18: 3, 19: 2, 20: 1 },
    bonusNotes: "Top 20 score same as 2004-2006. Bonus: fastest race lap +1; most positions improved +1; leading slowest qualifying group +1; pole/final qualification bonus per source table; leading-a-lap and most-laps-led bonuses removed per table. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems; https://www.champcarstats.com/points.htm",
  },
  "pts-indycar-1996": {
    id: "pts-indycar-1996",
    name: "IndyCar/IRL 1996 (35-33-32... multiplier)",
    pointsByPosition: { 1: 35, 2: 33, 3: 32, 4: 31, 5: 30, 6: 29, 7: 28, 8: 27, 9: 26, 10: 25, 11: 24, 12: 23, 13: 22, 14: 21, 15: 20, 16: 19, 17: 18, 18: 17, 19: 16, 20: 15, 21: 14, 22: 13, 23: 12, 24: 11, 25: 10, 26: 9, 27: 8, 28: 7, 29: 6, 30: 5, 31: 4, 32: 3, 33: 2, 34: 1, 35: 1 },
    bonusNotes: "Base points: 1st 35, 2nd 33, then descending by one through 34th/35th. 1996 standings multiplied each entrant/driver base total by number of races run. Exact 1996 race bonus values not verified separately; no extra bonus cells authored. Source: https://au.motorsport.com/indycar/news/irl-1996-calendar-and-points-scoring-systems-unveiled/1661917/; https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
  },
  "pts-indycar-1997": {
    id: "pts-indycar-1997",
    name: "IndyCar/IRL 1997 (35-33-32...)",
    pointsByPosition: { 1: 35, 2: 33, 3: 32, 4: 31, 5: 30, 6: 29, 7: 28, 8: 27, 9: 26, 10: 25, 11: 24, 12: 23, 13: 22, 14: 21, 15: 20, 16: 19, 17: 18, 18: 17, 19: 16, 20: 15, 21: 14, 22: 13, 23: 12, 24: 11, 25: 10, 26: 9, 27: 8, 28: 7, 29: 6, 30: 5, 31: 4, 32: 3, 33: 2, 34: 1, 35: 1 },
    bonusNotes: "Base points: 1st 35, 2nd 33, then descending by one through 35th. Bonus: most laps led +1; pole/final qualification bonus shown as +2 in source table. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
  },
  "pts-indycar-1998-2000": {
    id: "pts-indycar-1998-2000",
    name: "IndyCar/IRL 1998-2000 (50-40-35...)",
    pointsByPosition: { 1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20, 11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 11, 20: 10, 21: 9, 22: 8, 23: 7, 24: 6, 25: 5, 26: 4, 27: 3, 28: 2, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1 },
    bonusNotes: "Top 33 score 50-40-35-32-30-28-26-24-22-20-19... with 1 point for positions 29-33. Bonus: most laps led +2; qualifying/pole bonuses shown in source table. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
  },
  "pts-indycar-2001-2003": {
    id: "pts-indycar-2001-2003",
    name: "IndyCar/IRL 2001-2003 (50-40-35...)",
    pointsByPosition: { 1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20, 11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 11, 20: 10, 21: 9, 22: 8, 23: 7, 24: 6, 25: 5, 26: 4, 27: 3, 28: 2, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1 },
    bonusNotes: "Same base structure as 1998-2000. Bonus: most laps led +2; no pole/final qualifying bonus shown for 2001-2003. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
  },
  "pts-indycar-2004-2007": {
    id: "pts-indycar-2004-2007",
    name: "IndyCar 2004-2007 (50-40-35... plateaus)",
    pointsByPosition: { 1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20, 11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 12, 20: 12, 21: 12, 22: 12, 23: 12, 24: 12, 25: 10, 26: 10, 27: 10, 28: 10, 29: 10, 30: 10, 31: 10, 32: 10, 33: 10 },
    bonusNotes: "Top 33 score 50-40-35-32-30-28-26-24-22-20-19...; positions 18-24 score 12; positions 25-33 score 10. Bonus: most laps led +3. Non-starters got full race points in 2004-2005 and half race points from 2006. Source: https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
  },
};

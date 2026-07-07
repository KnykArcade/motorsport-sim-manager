import type { PointsSystem } from '../../types/gameTypes';

export const aowPointsSystems: Record<string, PointsSystem> = {
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
    bonusNotes: "Base points: 1st 35, 2nd 33, then descending by one through 34th/35th. 1996 standings multiplied each entrant/driver base total by number of races run. Exact 1996 race bonus values not verified separately; no extra bonus cells authored. Source: https://au.motorsport.com/indycar/news/irl-1996-calendar-and-points-system-unveiled/1661917/; https://en.wikipedia.org/wiki/List_of_American_Championship_car_racing_points_scoring_systems",
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

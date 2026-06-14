import { FighterStats } from "../fighter/fighter";

export interface FighterData {
  id: number;
  name: string;
  nick: string;
  skinId: number;
  photo: string;
  stats: FighterStats;
}

// power ~0.85–1.35 · speed ~0.85–1.2 · defense ~0.1–0.3 · chin ~0.4–0.8
export const ROSTER: FighterData[] = [
  { id: 0, name: "Silva", nick: "O Monstro", skinId: 0, photo: "/lutadores/silva.png",
    stats: { power: 1.35, speed: 1.18, defense: 0.30, chin: 0.42 } },
  { id: 1, name: "Luan", nick: "Muralha", skinId: 1, photo: "/lutadores/luan.png",
    stats: { power: 1.20, speed: 0.85, defense: 0.18, chin: 0.80 } },
  { id: 2, name: "Zezeca", nick: "Relâmpago", skinId: 2, photo: "/lutadores/zezeca.png",
    stats: { power: 0.85, speed: 1.18, defense: 0.27, chin: 0.42 } },
  { id: 3, name: "Chagas", nick: "Dinamite", skinId: 3, photo: "/lutadores/chagas.png",
    stats: { power: 1.20, speed: 1.18, defense: 0.12, chin: 0.42 } },
  { id: 4, name: "Lipe", nick: "Agulha", skinId: 4, photo: "/lutadores/lipe.png",
    stats: { power: 0.85, speed: 1.18, defense: 0.27, chin: 0.70 } },
  { id: 5, name: "Rigueira", nick: "Vento", skinId: 5, photo: "/lutadores/rigueira.png",
    stats: { power: 0.85, speed: 1.18, defense: 0.27, chin: 0.70 } },
  { id: 6, name: "Luiz", nick: "Bisturi", skinId: 6, photo: "/lutadores/luiz.png",
    stats: { power: 1.00, speed: 1.18, defense: 0.27, chin: 0.70 } },
  { id: 7, name: "Barbosa", nick: "Rochedo", skinId: 7, photo: "/lutadores/barbosa.png",
    stats: { power: 1.00, speed: 1.18, defense: 0.27, chin: 0.70 } },
];

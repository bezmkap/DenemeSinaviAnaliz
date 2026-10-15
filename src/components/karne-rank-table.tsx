"use client";

import { useState } from "react";
import {
  AYT_RANK_TRACKS,
  type KarneRankSet,
  type KarneRankSets,
  type KarneRankTrack,
  type StudentKarne,
} from "@/lib/analiz/compute";

function fallbackRankSet(card: StudentKarne): KarneRankSet {
  return {
    schoolRank: card.totals.schoolRank,
    schoolCount: card.totals.schoolCount,
    cityRank: card.totals.cityRank,
    cityCount: card.totals.cityCount,
    districtRank: card.totals.districtRank,
    districtCount: card.totals.districtCount,
  };
}

function rankLabel(rank: number | null | undefined, count: number | null | undefined): string {
  if (rank == null) return "—";
  if (count) return `${rank} / ${count}`;
  return String(rank);
}

export function RankTable({ card, examType }: { card: StudentKarne; examType: string }) {
  const sets = card.totals.rankSets;
  const hasAytTracks = examType === "AYT" && Boolean(sets);
  const [track, setTrack] = useState<KarneRankTrack>("soz");
  const current = hasAytTracks && sets ? sets[track] : (sets?.genel ?? fallbackRankSet(card));
  const activeHint = AYT_RANK_TRACKS.find((tab) => tab.id === track)?.hint;

  return (
    <div className="karne-rank">
      <p className="karne-kicker">Sıralama</p>
      {hasAytTracks ? (
        <>
          <div className="karne-rank-tabs" role="tablist" aria-label="Sıralama puan türü">
            {AYT_RANK_TRACKS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={track === tab.id}
                className={`karne-rank-tab${track === tab.id ? " is-active" : ""}`}
                onClick={() => setTrack(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="karne-rank-basis">{activeHint}</p>
        </>
      ) : null}
      <table className={`karne-table${hasAytTracks ? " karne-rank-screen" : ""}`}>
        <thead>
          <tr>
            <th />
            <th>İl</th>
            <th>İlçe</th>
            <th>Okul</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Sıra</td>
            <td className="font-mono">{rankLabel(current.cityRank, current.cityCount)}</td>
            <td className="font-mono">{rankLabel(current.districtRank, current.districtCount)}</td>
            <td className="font-mono">{rankLabel(current.schoolRank, current.schoolCount)}</td>
          </tr>
        </tbody>
      </table>
      {hasAytTracks && sets ? <PrintRankTable sets={sets} /> : null}
    </div>
  );
}

function PrintRankTable({ sets }: { sets: KarneRankSets }) {
  return (
    <table className="karne-table karne-rank-print">
      <thead>
        <tr>
          <th>Puana göre</th>
          <th>İl</th>
          <th>İlçe</th>
          <th>Okul</th>
        </tr>
      </thead>
      <tbody>
        {AYT_RANK_TRACKS.map((tab) => (
          <tr key={tab.id}>
            <td>{tab.label}</td>
            <td className="font-mono">{rankLabel(sets[tab.id].cityRank, sets[tab.id].cityCount)}</td>
            <td className="font-mono">{rankLabel(sets[tab.id].districtRank, sets[tab.id].districtCount)}</td>
            <td className="font-mono">{rankLabel(sets[tab.id].schoolRank, sets[tab.id].schoolCount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

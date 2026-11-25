"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, SHEET_NAME, type ImportPreview } from "@/lib/catalog-import";

type Code = { name: string; slug: string };
type ImportRow = { row: number; cells: string[] };
type ImportResult = { preview: ImportPreview[]; created: number };

export function CatalogImportForm({ categories, cities }: { categories: Code[]; cities: Code[] }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);

  async function download() {
    setBusy(true);
    setError(undefined);
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      const articles = workbook.addWorksheet(SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
      articles.addRow([...IMPORT_COLUMNS]).font = { bold: true };
      [18, 30, 45, 24, 20, 12, 24, 30].forEach((width, index) => { articles.getColumn(index + 1).width = width; });
      articles.getColumn(1).numFmt = "@";
      for (const [title, codes] of [["Catégories", categories], ["Villes", cities]] as const) {
        const sheet = workbook.addWorksheet(title);
        sheet.columns = [{ header: "Nom", width: 40 }, { header: "Code à recopier", width: 30 }];
        sheet.getRow(1).font = { bold: true };
        sheet.addRows(codes.map(({ name, slug }) => [name, slug]));
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "modele-catalogue-loc-connect.xlsx";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Impossible de générer le modèle Excel.");
    } finally {
      setBusy(false);
    }
  }

  async function preview(file?: File) {
    setRows([]);
    setResult(undefined);
    setComplete(false);
    setError(undefined);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 2_000_000) {
      setError("Choisissez un fichier Excel .xlsx de 2 Mo maximum.");
      return;
    }
    setBusy(true);
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet(SHEET_NAME);
      if (!sheet || !IMPORT_COLUMNS.every((title, index) => sheet.getRow(1).getCell(index + 1).text.trim() === title)) {
        setError("Onglet ou en-têtes introuvables. Utilisez le modèle Excel téléchargé.");
        return;
      }
      const imported: ImportRow[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const cells = IMPORT_COLUMNS.map((_, column) => row.getCell(column + 1).text.trim());
        if (cells.some(Boolean)) imported.push({ row: index, cells });
        if (imported.length > MAX_IMPORT_ROWS) throw new Error(`Le fichier est limité à ${MAX_IMPORT_ROWS} articles.`);
      });
      if (!imported.length) {
        setError("Ajoutez au moins un article dans l’onglet Articles.");
        return;
      }
      const response = await api<ImportResult>("/api/products/import", { body: { commit: false, rows: imported } });
      setRows(imported);
      setResult(response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error && e.message.startsWith("Le fichier est limité") ? e.message : "Impossible de lire ce fichier Excel.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      setResult(await api<ImportResult>("/api/products/import", { body: { commit: true, rows } }));
      setComplete(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d’importer le catalogue.");
    } finally {
      setBusy(false);
    }
  }

  const ready = result?.preview.filter(({ status }) => status === "ready").length ?? 0;
  const errors = result?.preview.filter(({ status }) => status === "error").length ?? 0;

  return (
    <Card className="space-y-5 p-5">
      <Button variant="secondary" onClick={download} disabled={busy}>Télécharger le modèle Excel</Button>
      <p className="text-sm text-muted">Remplissez l’onglet Articles avec une référence unique par fiche. Recopiez les codes des onglets Catégories et Villes. Les fiches sont créées en brouillon.</p>
      <Input label="Fichier catalogue (.xlsx)" type="file" accept=".xlsx" disabled={busy} onChange={(event) => {
        void preview(event.target.files?.[0]);
        event.target.value = "";
      }} />
      {busy && <p role="status" className="text-sm text-muted">Traitement en cours…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {complete && <p role="status" className="text-sm font-medium text-ink">{result?.created ?? 0} fiche(s) créée(s) en brouillon. <Link href="/loueur/produits?status=DRAFT" className="text-royal-ink underline">Voir les brouillons</Link></p>}
      {result && !complete && (
        <>
          <p className="text-sm font-medium">{ready} prête(s) · {errors} à corriger · {result.preview.length - ready - errors} déjà importée(s)</p>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-control border border-line">
            {result.preview.map((item, index) => (
              <li key={index} className="break-words px-3 py-2 text-sm">
                <p className="font-medium">Ligne {item.row} · {item.reference || "Sans référence"}{item.name && ` · ${item.name}`}</p>
                <p className={item.status === "error" ? "text-danger" : "text-muted"}>{item.message ?? "Prête à importer"}</p>
              </li>
            ))}
          </ul>
          <Button onClick={confirm} disabled={busy || errors > 0 || ready === 0}>Créer les brouillons</Button>
        </>
      )}
    </Card>
  );
}

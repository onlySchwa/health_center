import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatTimestamp } from "@/lib/admin";
import { groupings, longDate, reportStatuses, summarize, type ReportFilters, type ReportRow } from "@/lib/reports";

// Brand colors from app/globals.css; react-pdf can't read the Tailwind theme.
const navy = "#0E3B4A";
const teal = "#1F7F7C";
const orange = "#C4511F";
const muted = "#3E5A61";
const line = "#DCE5E6";
const mist = "#F3F6F6";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: "#10252C" },
  eyebrow: { fontSize: 8, color: teal, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: navy, marginTop: 4 },
  subtitle: { fontSize: 10, color: muted, marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  box: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 8, padding: 10 },
  big: { fontSize: 18, fontFamily: "Helvetica-Bold", color: navy },
  boxLabel: { fontSize: 8, color: muted, marginTop: 3 },
  section: { marginTop: 18 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: navy, marginBottom: 8 },
  barTrack: { height: 6, backgroundColor: mist, borderRadius: 3, marginTop: 3 },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: muted, textTransform: "uppercase" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: muted },
});

const cols = { ref: "14%", date: "22%", time: "27%", service: "25%", status: "12%" };

function Bars({ items, total, color, capitalize }: { items: [string, number][]; total: number; color: string; capitalize?: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      {items.map(([label, count]) => (
        <View key={label}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={capitalize ? { textTransform: "capitalize" } : {}}>{label}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{count}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${total ? (count / total) * 100 : 0}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ReportDocument({ filters, rows, generatedAt }: { filters: ReportFilters; rows: ReportRow[]; generatedAt: string }) {
  const report = summarize(rows, filters);
  const groupLabel = groupings.find((g) => g.id === filters.group)!.label;
  const max = Math.max(1, ...report.series.map((p) => p.count));
  const every = Math.ceil(report.series.length / 12);
  const topService = report.byService[0]?.[1] ? report.byService[0][0] : "—";

  return (
    <Document title={`Appointments report ${filters.from} to ${filters.to}`} author="Baan Health Care">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Baan KM 3 Barangay Health Center</Text>
        <Text style={s.title}>Appointments report</Text>
        <Text style={s.subtitle}>
          {longDate(filters.from)} – {longDate(filters.to)} · {filters.service || "All services"} · Generated {generatedAt}
        </Text>

        <View style={[s.row, s.section]}>
          <View style={s.box}>
            <Text style={s.big}>{report.total}</Text>
            <Text style={s.boxLabel}>Appointments</Text>
          </View>
          <View style={s.box}>
            <Text style={[s.big, { fontSize: 13, color: teal }]}>{topService}</Text>
            <Text style={s.boxLabel}>Most requested service</Text>
          </View>
          <View style={s.box}>
            <Text style={[s.big, { fontSize: 13, color: orange }]}>
              {report.busiest ? `${longDate(report.busiest.date).split(",").slice(0, 2).join(",")} (${report.busiest.count})` : "—"}
            </Text>
            <Text style={s.boxLabel}>Busiest day</Text>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>{groupLabel} appointments</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 2, borderBottomWidth: 1, borderBottomColor: line }}>
            {report.series.map((p) => (
              <View key={p.start} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                {p.count > 0 && <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: navy, marginBottom: 2 }}>{p.count}</Text>}
                <View style={{ width: "80%", height: p.count ? (p.count / max) * 100 : 2, backgroundColor: p.count ? teal : line, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 2, marginTop: 3 }}>
            {report.series.map((p, i) => (
              <Text key={p.start} style={{ flex: 1, fontSize: 6, color: muted, textAlign: "center" }}>
                {i % every === 0 ? p.label.replace("Week of ", "") : ""}
              </Text>
            ))}
          </View>
        </View>

        <View style={[s.row, s.section, { gap: 24 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>By status</Text>
            <Bars items={reportStatuses.map((st) => [st, report.byStatus[st]])} total={report.total} color={teal} capitalize />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Most requested services</Text>
            <Bars items={report.byService} total={Math.max(1, ...report.byService.map(([, n]) => n))} color={orange} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Appointments ({rows.length})</Text>
          <View style={[s.tr, { borderBottomColor: muted }]} fixed>
            <Text style={[s.th, { width: cols.ref }]}>ID</Text>
            <Text style={[s.th, { width: cols.date }]}>Date</Text>
            <Text style={[s.th, { width: cols.time }]}>Time</Text>
            <Text style={[s.th, { width: cols.service }]}>Service</Text>
            <Text style={[s.th, { width: cols.status }]}>Status</Text>
          </View>
          {rows.length === 0 && <Text style={{ paddingVertical: 10, color: muted }}>No appointments in this range.</Text>}
          {rows.map((r) => (
            <View key={r.ref} style={s.tr} wrap={false}>
              <Text style={{ width: cols.ref }}>{r.ref}</Text>
              <Text style={{ width: cols.date }}>{longDate(r.appt_date)}</Text>
              <Text style={{ width: cols.time }}>{r.time_slot}</Text>
              <Text style={{ width: cols.service }}>{r.service}</Text>
              <Text style={{ width: cols.status, textTransform: "capitalize" }}>{r.status}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>Non-archived appointments by visit date. No contact details included.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderReportPdf(filters: ReportFilters, rows: ReportRow[]) {
  return renderToBuffer(<ReportDocument filters={filters} rows={rows} generatedAt={formatTimestamp(new Date().toISOString())} />);
}

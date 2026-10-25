import { Download, FileSpreadsheet, Users } from "lucide-react";
import { DoctorsTable } from "@/components/doctors-table";
import { ImportButton } from "@/components/import-dialog";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { getLastImport } from "@/lib/doctors";
import { listDoctors } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Doctors" };

export default async function DoctorsPage() {
  const [doctors, lastImport] = await Promise.all([listDoctors(), getLastImport()]);
  const active = doctors.filter((d) => d.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Doctors"
        title="Who receives the articles"
        description={
          doctors.length ? (
            <>
              {active.toLocaleString("en-IN")} of {doctors.length.toLocaleString("en-IN")} doctors receive emails.
              {lastImport && (
                <>
                  {" "}
                  Last updated from <span className="text-ink">{lastImport.fileName}</span> on {formatDateTime(new Date(lastImport.at))}.
                </>
              )}
            </>
          ) : (
            "Upload one Excel sheet with your doctors. To make changes later, edit the sheet and upload it again."
          )
        }
        actions={
          <>
            {/* Plain links: these are file downloads, not page navigations. */}
            <a href="/api/doctors/template" download className={buttonClass("ghost")}>
              <FileSpreadsheet className="size-4" />
              Template
            </a>
            {doctors.length > 0 && (
              <a href="/api/doctors/export" download className={buttonClass("secondary")}>
                <Download className="size-4" />
                Download list
              </a>
            )}
            <ImportButton hasDoctors={doctors.length > 0} />
          </>
        }
      />

      {doctors.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-5" />} title="No doctors yet">
            Your sheet needs an <b className="font-medium text-ink">Email</b> column. Name, Specialty, City and Hospital are optional. Download the template if you&apos;d like a starting point.
          </EmptyState>
        </Card>
      ) : (
        <DoctorsTable doctors={doctors} />
      )}
    </>
  );
}

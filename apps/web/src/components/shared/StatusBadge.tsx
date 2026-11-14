import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AssignmentStatus,
  ExtractionStatus,
  Recommendation,
  SubmissionStatus,
} from "@/lib/domain/types";
import { useTranslations } from "next-intl";

type StatusType =
  | { kind: "submission"; value: SubmissionStatus }
  | { kind: "assignment"; value: AssignmentStatus }
  | { kind: "recommendation"; value: Recommendation }
  | { kind: "extraction"; value: ExtractionStatus };

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tStatus = useTranslations("status");
  const tAssignment = useTranslations("assignmentStatus");
  const tRec = useTranslations("recommendation");
  const tExtract = useTranslations("extractionStatus");

  let label = "";
  let variant: "default" | "outline" | "success" | "warning" | "danger" | "accent" = "default";

  switch (status.kind) {
    case "submission":
      label = tStatus(status.value);
      switch (status.value) {
        case "draft":
          variant = "outline";
          break;
        case "submitted":
          variant = "accent";
          break;
        case "in_review":
          variant = "warning";
          break;
        case "revisions_requested":
          variant = "warning";
          break;
        case "accepted":
        case "published":
          variant = "success";
          break;
        case "rejected":
          variant = "danger";
          break;
      }
      break;

    case "assignment":
      label = tAssignment(status.value);
      switch (status.value) {
        case "invited":
          variant = "warning";
          break;
        case "accepted":
          variant = "accent";
          break;
        case "completed":
          variant = "success";
          break;
        case "declined":
          variant = "danger";
          break;
      }
      break;

    case "recommendation":
      label = tRec(status.value);
      switch (status.value) {
        case "accept":
          variant = "success";
          break;
        case "minor_revisions":
        case "major_revisions":
          variant = "warning";
          break;
        case "reject":
          variant = "danger";
          break;
      }
      break;

    case "extraction":
      label = tExtract(status.value);
      switch (status.value) {
        case "not_started":
          variant = "outline";
          break;
        case "pending":
          variant = "accent";
          break;
        case "succeeded":
          variant = "success";
          break;
        case "failed":
          variant = "danger";
          break;
      }
      break;
  }

  return (
    <Badge
      variant={variant}
      className={cn("font-medium tracking-normal text-[12px] py-0.5 px-2", className)}
      role="status"
    >
      {label}
    </Badge>
  );
}

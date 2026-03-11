export const projectionSectionCardSx = {
  p: { xs: 2, md: 3 },
  mb: 3,
  borderRadius: 2,
  border: "1px solid transparent",
  background:
    "radial-gradient(130% 110% at 50% 100%, rgba(56, 189, 248, 0.09) 0%, rgba(56, 189, 248, 0) 68%), linear-gradient(180deg, #0f172a 0%, #111827 100%)",
  boxShadow: "0 14px 28px rgba(2, 6, 23, 0.32)",
  color: "#e2e8f0",
};

export const projectionActionButtonSx = {
  textTransform: "none",
  background: "linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)",
  color: "#fff",
  border: "none",
  boxShadow: "0 2px 4px rgba(0, 163, 224, 0.25)",
  "&:hover": {
    background: "linear-gradient(135deg, #0F2847 0%, #00a3e0 100%)",
    filter: "brightness(1.08)",
    boxShadow: "0 4px 8px rgba(0, 163, 224, 0.35)",
  },
};

export const projectionSecondaryButtonSx = {
  textTransform: "none",
  borderColor: "rgba(148, 163, 184, 0.44)",
  color: "#e2e8f0",
  background: "rgba(15, 23, 42, 0.35)",
  "&:hover": {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
};

export const projectionCheckboxSx = {
  color: "#00a3e0",
  "&.Mui-checked": {
    color: "#00a3e0",
  },
};

export const projectionSwitchSx = {
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: "#00a3e0",
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: "#00a3e0",
    opacity: 1,
  },
};

export const projectionTableContainerSx = {
  overflowX: "auto",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderRadius: 1.5,
  bgcolor: "rgba(2, 6, 23, 0.35)",
  "& .MuiTableCell-head": {
    fontWeight: 600,
    bgcolor: "rgba(15, 23, 42, 0.75)",
    color: "#cbd5e1",
    borderColor: "rgba(148, 163, 184, 0.22)",
  },
  "& .MuiTableCell-body": {
    color: "#e2e8f0",
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  "& .MuiTableRow-root:hover": {
    bgcolor: "rgba(56, 189, 248, 0.08)",
  },
};

export const projectionSectionCardSx = {
  p: { xs: 2, md: 3 },
  mb: 3,
  borderRadius: 2,
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
  borderColor: "#0F2847",
  color: "#0F2847",
  "&:hover": {
    borderColor: "#0F2847",
    backgroundColor: "rgba(15, 40, 71, 0.06)",
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
  "& .MuiTableCell-head": {
    fontWeight: 600,
    bgcolor: "grey.50",
  },
};

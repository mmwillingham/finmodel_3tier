from copy import deepcopy

from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE


DEFAULT_DOCUMENT_TYPE_DEFINITIONS = [
    {
        "template_key": "financial-life-insurance",
        "category": "Financial",
        "doc_type": "Life Insurance",
        "description": "Store carrier, policy, and beneficiary details.",
        "fields_config": [
            {"id": "carrier", "label": "Insurance Carrier", "field_type": "text", "required": True},
            {"id": "policy_number", "label": "Policy Number", "field_type": "text", "required": True, "is_sensitive": True},
            {"id": "agent_name", "label": "Agent Name", "field_type": "text", "required": False},
            {"id": "phone", "label": "Phone", "field_type": "phone", "required": False},
            {"id": "beneficiaries", "label": "Beneficiaries", "field_type": "textarea", "required": False},
        ],
    },
    {
        "template_key": "financial-asset-account",
        "category": "Financial",
        "doc_type": "Asset Account",
        "description": "Track account ownership and access details.",
        "fields_config": [
            {"id": "institution_name", "label": "Institution Name", "field_type": "text", "required": True},
            {"id": "account_number", "label": "Account Number", "field_type": "text", "required": False, "is_sensitive": True},
            {"id": "advisor_name", "label": "Advisor Name", "field_type": "text", "required": False},
            {"id": "contact_email", "label": "Contact Email", "field_type": "email", "required": False},
            {"id": "beneficiaries", "label": "Beneficiaries", "field_type": "textarea", "required": False},
        ],
    },
    {
        "template_key": "legal-will",
        "category": "Legal",
        "doc_type": "Will",
        "description": "Record execution details and storage location.",
        "fields_config": [
            {"id": "attorney_name", "label": "Attorney Name", "field_type": "text", "required": False},
            {"id": "execution_date", "label": "Execution Date", "field_type": "date", "required": False},
            {"id": "witnesses", "label": "Witnesses", "field_type": "textarea", "required": False},
            {"id": "original_location", "label": "Location of Original", "field_type": "text", "required": False},
        ],
    },
    {
        "template_key": "health-insurance",
        "category": "Health",
        "doc_type": "Health Insurance",
        "description": "Capture policy IDs and provider contacts.",
        "fields_config": [
            {"id": "provider_name", "label": "Provider Name", "field_type": "text", "required": True},
            {"id": "member_id", "label": "Member ID", "field_type": "text", "required": True, "is_sensitive": True},
            {"id": "group_number", "label": "Group Number", "field_type": "text", "required": False},
            {"id": "provider_phone", "label": "Provider Phone", "field_type": "phone", "required": False},
            {"id": "website", "label": "Website", "field_type": "url", "required": False},
        ],
    },
    {
        "template_key": "digital-password-management",
        "category": "Digital Assets",
        "doc_type": "Password Management",
        "description": "Track login, recovery, and storage details.",
        "fields_config": [
            {"id": "provider_name", "label": "Provider Name", "field_type": "text", "required": True},
            {"id": "login_username", "label": "Login Email or Username", "field_type": "text", "required": True, "is_sensitive": True},
            {"id": "recovery_info", "label": "Recovery Info", "field_type": "textarea", "required": False, "is_sensitive": True},
            {"id": "service_url", "label": "Service URL", "field_type": "url", "required": False},
        ],
    },
    {
        "template_key": "contacts-emergency",
        "category": "Contacts",
        "doc_type": "Emergency Contact",
        "description": "Maintain a primary emergency contact record.",
        "fields_config": [
            {"id": "contact_name", "label": "Name", "field_type": "text", "required": True},
            {"id": "relationship", "label": "Relationship", "field_type": "text", "required": False},
            {"id": "phone", "label": "Phone", "field_type": "phone", "required": False},
            {"id": "email", "label": "Email", "field_type": "email", "required": False},
            {"id": "address", "label": "Address", "field_type": "textarea", "required": False},
        ],
    },
]


def _build_folder_based_definitions(folder_structure):
    definitions = []

    def walk(items, top_level=None, prefix=None):
        for item in items:
            name = item["name"]
            current_path = f"{prefix} / {name}" if prefix else name
            current_top_level = top_level or name
            remainder = current_path if current_top_level == current_path else current_path[len(current_top_level) + 3 :]

            definitions.append(
                {
                    "template_key": f"folder-{slugify_key(current_path)}",
                    "category": current_top_level,
                    "doc_type": remainder if remainder else current_top_level,
                    "description": f"Recommended default for {current_path}.",
                    "fields_config": [],
                }
            )

            children = item.get("children") or []
            if children:
                walk(children, current_top_level, current_path)

    walk(folder_structure or DEFAULT_DOCUMENT_FOLDER_STRUCTURE)
    return definitions


def slugify_key(value: str) -> str:
    cleaned = []
    previous_dash = False
    for char in value.lower():
        if char.isalnum():
            cleaned.append(char)
            previous_dash = False
        elif not previous_dash:
            cleaned.append("-")
            previous_dash = True
    return "".join(cleaned).strip("-")


def build_default_document_type_definitions(folder_structure=None):
    combined = deepcopy(DEFAULT_DOCUMENT_TYPE_DEFINITIONS) + _build_folder_based_definitions(folder_structure)
    deduped = {}
    for item in combined:
        deduped[item["template_key"]] = item
    return list(deduped.values())

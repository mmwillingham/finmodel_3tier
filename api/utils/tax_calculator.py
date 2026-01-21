"""
Federal and State Tax Calculator

Calculates federal and state income tax based on:
- Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
- Age (65+ gets higher standard deduction)
- Taxable income (income minus deductions)
- Tax-deductible expenses
- Qualified dividends (taxed at capital gains rates: 0%, 15%, 20%)
- State of residence

Uses 2025 federal and state tax brackets and standard deductions.
"""

from typing import List, Tuple, Optional
from datetime import datetime


# 2025 Federal Tax Brackets (Single)
TAX_BRACKETS_SINGLE = [
    (0, 0.10),          # 10% up to $11,925
    (11925, 0.12),      # 12% from $11,925 to $48,475
    (48475, 0.22),      # 22% from $48,475 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $626,350
    (626350, 0.37),     # 37% above $626,350
]

# 2025 Federal Tax Brackets (Married Filing Jointly)
TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.10),          # 10% up to $23,850
    (23850, 0.12),      # 12% from $23,850 to $96,950
    (96950, 0.22),      # 22% from $96,950 to $206,700
    (206700, 0.24),     # 24% from $206,700 to $394,600
    (394600, 0.32),     # 32% from $394,600 to $501,050
    (501050, 0.35),     # 35% from $501,050 to $752,700
    (752700, 0.37),     # 37% above $752,700
]

# 2025 Federal Tax Brackets (Married Filing Separately)
TAX_BRACKETS_MARRIED_SEPARATELY = [
    (0, 0.10),          # 10% up to $11,925
    (11925, 0.12),      # 12% from $11,925 to $48,475
    (48475, 0.22),      # 22% from $48,475 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $376,350
    (376350, 0.37),     # 37% above $376,350
]

# 2025 Federal Tax Brackets (Head of Household)
TAX_BRACKETS_HEAD_OF_HOUSEHOLD = [
    (0, 0.10),          # 10% up to $17,000
    (17000, 0.12),      # 12% from $17,000 to $64,700
    (64700, 0.22),      # 22% from $64,700 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $626,350
    (626350, 0.37),     # 37% above $626,350
]

# 2025 Standard Deductions
STANDARD_DEDUCTION_SINGLE = 14950
STANDARD_DEDUCTION_MARRIED_JOINTLY = 29900
STANDARD_DEDUCTION_MARRIED_SEPARATELY = 14950
STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD = 22400

# Additional standard deduction for age 65+ (2025)
ADDITIONAL_DEDUCTION_65_PLUS = 1900  # Per person 65 or older

# 2025 Qualified Dividend / Long-Term Capital Gains Tax Brackets
# These are the thresholds for determining the rate on qualified dividends
QUALIFIED_DIVIDEND_BRACKETS_SINGLE = [
    (0, 0.0),           # 0% up to $47,025
    (47025, 0.15),      # 15% from $47,025 to $518,900
    (518900, 0.20),     # 20% above $518,900
]

QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0),           # 0% up to $94,050
    (94050, 0.15),      # 15% from $94,050 to $583,750
    (583750, 0.20),     # 20% above $583,750
]

QUALIFIED_DIVIDEND_BRACKETS_MARRIED_SEPARATELY = [
    (0, 0.0),           # 0% up to $47,025
    (47025, 0.15),      # 15% from $47,025 to $291,850
    (291850, 0.20),     # 20% above $291,850
]

QUALIFIED_DIVIDEND_BRACKETS_HEAD_OF_HOUSEHOLD = [
    (0, 0.0),           # 0% up to $63,000
    (63000, 0.15),      # 15% from $63,000 to $551,350
    (551350, 0.20),     # 20% above $551,350
]

# 2025 State Tax Brackets - California (progressive)
# California uses same brackets for all filing statuses (tax is calculated per person for MFJ)
CALIFORNIA_TAX_BRACKETS = [
    (0, 0.01),          # 1% up to $10,099
    (10099, 0.02),      # 2% from $10,099 to $23,942
    (23942, 0.04),      # 4% from $23,942 to $37,788
    (37788, 0.06),      # 6% from $37,788 to $52,455
    (52455, 0.08),      # 8% from $52,455 to $66,295
    (66295, 0.093),     # 9.3% from $66,295 to $338,639
    (338639, 0.103),    # 10.3% from $338,639 to $406,364
    (406364, 0.113),    # 11.3% from $406,364 to $677,275
    (677275, 0.123),    # 12.3% above $677,275
]

CALIFORNIA_STANDARD_DEDUCTION = {
    "Single": 5540,
    "Married Filing Jointly": 11080,
    "Married Filing Separately": 5540,
    "Head of Household": 11080,
}

# 2025 State Tax Brackets - New York (progressive, varies by filing status)
NEW_YORK_TAX_BRACKETS_SINGLE = [
    (0, 0.04),          # 4% up to $8,500
    (8500, 0.045),      # 4.5% from $8,500 to $11,700
    (11700, 0.0525),    # 5.25% from $11,700 to $13,900
    (13900, 0.055),     # 5.5% from $13,900 to $21,400
    (21400, 0.06),      # 6% from $21,400 to $80,650
    (80650, 0.0685),    # 6.85% from $80,650 to $215,400
    (215400, 0.0965),   # 9.65% from $215,400 to $1,077,550
    (1077550, 0.103),   # 10.3% from $1,077,550 to $5,000,000
    (5000000, 0.109),   # 10.9% above $5,000,000
]

NEW_YORK_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.04),          # 4% up to $17,150
    (17150, 0.045),     # 4.5% from $17,150 to $23,600
    (23600, 0.0525),    # 5.25% from $23,600 to $27,900
    (27900, 0.055),     # 5.5% from $27,900 to $43,000
    (43000, 0.06),      # 6% from $43,000 to $161,550
    (161550, 0.0685),   # 6.85% from $161,550 to $323,200
    (323200, 0.0965),   # 9.65% from $323,200 to $2,155,350
    (2155350, 0.103),   # 10.3% from $2,155,350 to $5,000,000
    (5000000, 0.109),   # 10.9% above $5,000,000
]

NEW_YORK_STANDARD_DEDUCTION = {
    "Single": 8000,
    "Married Filing Jointly": 16050,
    "Married Filing Separately": 8000,
    "Head of Household": 11200,
}

# 2025 State Tax Brackets - Georgia (progressive, flat rate structure)
# Georgia uses a flat rate of 5.49% for all income over $7,000 (2025)
# However, there's a tiered structure with different rates for different income levels
GEORGIA_TAX_BRACKETS = [
    (0, 0.01),          # 1% up to $750
    (750, 0.02),        # 2% from $750 to $2,250
    (2250, 0.03),       # 3% from $2,250 to $3,750
    (3750, 0.04),       # 4% from $3,750 to $5,250
    (5250, 0.05),       # 5% from $5,250 to $7,000
    (7000, 0.0549),     # 5.49% above $7,000 (flat rate for all income above threshold)
]

GEORGIA_STANDARD_DEDUCTION = {
    "Single": 5400,
    "Married Filing Jointly": 7100,
    "Married Filing Separately": 3550,
    "Head of Household": 7100,
}

# 2025 State Tax Brackets - Additional States

# Alabama (progressive)
ALABAMA_TAX_BRACKETS = [
    (0, 0.02),      # 2% up to $500
    (500, 0.04),    # 4% from $500 to $3,000
    (3000, 0.05),   # 5% above $3,000
]

ALABAMA_STANDARD_DEDUCTION = {
    "Single": 2500,
    "Married Filing Jointly": 7500,
    "Married Filing Separately": 3750,
    "Head of Household": 4700,
}

# Alaska - No state income tax (handled in NO_INCOME_TAX_STATES)

# Arizona (progressive, flat rate 2.5% for 2025)
ARIZONA_TAX_BRACKETS = [
    (0, 0.025),     # 2.5% flat rate
]

ARIZONA_STANDARD_DEDUCTION = {
    "Single": 14290,
    "Married Filing Jointly": 28580,
    "Married Filing Separately": 14290,
    "Head of Household": 21435,
}

# Arkansas (progressive)
ARKANSAS_TAX_BRACKETS = [
    (0, 0.00),      # 0% up to $4,400
    (4400, 0.02),   # 2% from $4,400 to $8,800
    (8800, 0.03),   # 3% from $8,800 to $13,200
    (13200, 0.037), # 3.7% from $13,200 to $22,000
    (22000, 0.047), # 4.7% from $22,000 to $38,600
    (38600, 0.055), # 5.5% above $38,600
]

ARKANSAS_STANDARD_DEDUCTION = {
    "Single": 2290,
    "Married Filing Jointly": 4580,
    "Married Filing Separately": 2290,
    "Head of Household": 2290,
}

# Colorado (flat rate)
COLORADO_TAX_BRACKETS = [
    (0, 0.044),     # 4.4% flat rate
]

COLORADO_STANDARD_DEDUCTION = {
    "Single": 0,  # Colorado uses federal standard deduction
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Connecticut (progressive)
CONNECTICUT_TAX_BRACKETS_SINGLE = [
    (0, 0.03),      # 3% up to $10,000
    (10000, 0.05),  # 5% from $10,000 to $50,000
    (50000, 0.055), # 5.5% from $50,000 to $100,000
    (100000, 0.06), # 6% from $100,000 to $200,000
    (200000, 0.065),# 6.5% from $200,000 to $250,000
    (250000, 0.069),# 6.9% from $250,000 to $500,000
    (500000, 0.0699),# 6.99% above $500,000
]

CONNECTICUT_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.03),      # 3% up to $20,000
    (20000, 0.05),  # 5% from $20,000 to $100,000
    (100000, 0.055),# 5.5% from $100,000 to $200,000
    (200000, 0.06), # 6% from $200,000 to $400,000
    (400000, 0.065),# 6.5% from $400,000 to $500,000
    (500000, 0.069),# 6.9% from $500,000 to $1,000,000
    (1000000, 0.0699),# 6.99% above $1,000,000
]

CONNECTICUT_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Delaware (progressive)
DELAWARE_TAX_BRACKETS = [
    (0, 0.00),      # 0% up to $2,000
    (2000, 0.022),  # 2.2% from $2,000 to $5,000
    (5000, 0.033),  # 3.3% from $5,000 to $10,000
    (10000, 0.044), # 4.4% from $10,000 to $20,000
    (20000, 0.055), # 5.5% from $20,000 to $25,000
    (25000, 0.066), # 6.6% above $25,000
]

DELAWARE_STANDARD_DEDUCTION = {
    "Single": 3250,
    "Married Filing Jointly": 6500,
    "Married Filing Separately": 3250,
    "Head of Household": 3250,
}

# Florida - No state income tax (handled in NO_INCOME_TAX_STATES)

# Hawaii (progressive)
HAWAII_TAX_BRACKETS_SINGLE = [
    (0, 0.014),     # 1.4% up to $2,400
    (2400, 0.032),  # 3.2% from $2,400 to $4,800
    (4800, 0.055),  # 5.5% from $4,800 to $9,600
    (9600, 0.064),  # 6.4% from $9,600 to $14,400
    (14400, 0.068), # 6.8% from $14,400 to $19,200
    (19200, 0.072), # 7.2% from $19,200 to $24,000
    (24000, 0.076), # 7.6% from $24,000 to $36,000
    (36000, 0.079), # 7.9% from $36,000 to $48,000
    (48000, 0.0825),# 8.25% from $48,000 to $150,000
    (150000, 0.09), # 9% from $150,000 to $175,000
    (175000, 0.10), # 10% from $175,000 to $200,000
    (200000, 0.11), # 11% above $200,000
]

HAWAII_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.014),     # 1.4% up to $4,800
    (4800, 0.032),  # 3.2% from $4,800 to $9,600
    (9600, 0.055),  # 5.5% from $9,600 to $19,200
    (19200, 0.064), # 6.4% from $19,200 to $28,800
    (28800, 0.068), # 6.8% from $28,800 to $38,400
    (38400, 0.072), # 7.2% from $38,400 to $48,000
    (48000, 0.076), # 7.6% from $48,000 to $72,000
    (72000, 0.079), # 7.9% from $72,000 to $96,000
    (96000, 0.0825),# 8.25% from $96,000 to $300,000
    (300000, 0.09), # 9% from $300,000 to $350,000
    (350000, 0.10), # 10% from $350,000 to $400,000
    (400000, 0.11), # 11% above $400,000
]

HAWAII_STANDARD_DEDUCTION = {
    "Single": 2200,
    "Married Filing Jointly": 4400,
    "Married Filing Separately": 2200,
    "Head of Household": 3200,
}

# Idaho (progressive, flat rate 5.8% for 2025)
IDAHO_TAX_BRACKETS = [
    (0, 0.058),     # 5.8% flat rate
]

IDAHO_STANDARD_DEDUCTION = {
    "Single": 14600,
    "Married Filing Jointly": 29200,
    "Married Filing Separately": 14600,
    "Head of Household": 21900,
}

# Illinois (flat rate)
ILLINOIS_TAX_BRACKETS = [
    (0, 0.0495),    # 4.95% flat rate
]

ILLINOIS_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Indiana (flat rate)
INDIANA_TAX_BRACKETS = [
    (0, 0.0315),    # 3.15% flat rate
]

INDIANA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Iowa (progressive, flat rate 3.9% for 2025)
IOWA_TAX_BRACKETS = [
    (0, 0.039),     # 3.9% flat rate
]

IOWA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Kansas (progressive)
KANSAS_TAX_BRACKETS_SINGLE = [
    (0, 0.031),     # 3.1% up to $15,000
    (15000, 0.0525),# 5.25% from $15,000 to $30,000
    (30000, 0.057), # 5.7% above $30,000
]

KANSAS_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.031),     # 3.1% up to $30,000
    (30000, 0.0525),# 5.25% from $30,000 to $60,000
    (60000, 0.057), # 5.7% above $60,000
]

KANSAS_STANDARD_DEDUCTION = {
    "Single": 3500,
    "Married Filing Jointly": 8000,
    "Married Filing Separately": 4000,
    "Head of Household": 7000,
}

# Kentucky (flat rate)
KENTUCKY_TAX_BRACKETS = [
    (0, 0.045),     # 4.5% flat rate
]

KENTUCKY_STANDARD_DEDUCTION = {
    "Single": 2810,
    "Married Filing Jointly": 5620,
    "Married Filing Separately": 2810,
    "Head of Household": 2810,
}

# Louisiana (progressive)
LOUISIANA_TAX_BRACKETS_SINGLE = [
    (0, 0.0185),    # 1.85% up to $12,500
    (12500, 0.035), # 3.5% from $12,500 to $50,000
    (50000, 0.0425),# 4.25% above $50,000
]

LOUISIANA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0185),    # 1.85% up to $25,000
    (25000, 0.035), # 3.5% from $25,000 to $100,000
    (100000, 0.0425),# 4.25% above $100,000
]

LOUISIANA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Maine (progressive)
MAINE_TAX_BRACKETS_SINGLE = [
    (0, 0.058),     # 5.8% up to $26,050
    (26050, 0.0675),# 6.75% from $26,050 to $61,600
    (61600, 0.0715),# 7.15% above $61,600
]

MAINE_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.058),     # 5.8% up to $52,100
    (52100, 0.0675),# 6.75% from $52,100 to $123,200
    (123200, 0.0715),# 7.15% above $123,200
]

MAINE_STANDARD_DEDUCTION = {
    "Single": 14950,
    "Married Filing Jointly": 29900,
    "Married Filing Separately": 14950,
    "Head of Household": 22400,
}

# Maryland (progressive)
MARYLAND_TAX_BRACKETS_SINGLE = [
    (0, 0.02),      # 2% up to $1,000
    (1000, 0.03),   # 3% from $1,000 to $2,000
    (2000, 0.04),   # 4% from $2,000 to $3,000
    (3000, 0.0475), # 4.75% from $3,000 to $100,000
    (100000, 0.05), # 5% from $100,000 to $125,000
    (125000, 0.0525),# 5.25% from $125,000 to $150,000
    (150000, 0.055),# 5.5% from $150,000 to $250,000
    (250000, 0.0575),# 5.75% above $250,000
]

MARYLAND_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.02),      # 2% up to $1,000
    (1000, 0.03),   # 3% from $1,000 to $2,000
    (2000, 0.04),   # 4% from $2,000 to $3,000
    (3000, 0.0475), # 4.75% from $3,000 to $150,000
    (150000, 0.05), # 5% from $150,000 to $175,000
    (175000, 0.0525),# 5.25% from $175,000 to $225,000
    (225000, 0.055),# 5.5% from $225,000 to $300,000
    (300000, 0.0575),# 5.75% above $300,000
]

MARYLAND_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Massachusetts (flat rate)
MASSACHUSETTS_TAX_BRACKETS = [
    (0, 0.05),      # 5% flat rate
]

MASSACHUSETTS_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Michigan (flat rate)
MICHIGAN_TAX_BRACKETS = [
    (0, 0.0425),    # 4.25% flat rate
]

MICHIGAN_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Minnesota (progressive)
MINNESOTA_TAX_BRACKETS_SINGLE = [
    (0, 0.0535),    # 5.35% up to $31,690
    (31690, 0.068), # 6.8% from $31,690 to $104,090
    (104090, 0.0785),# 7.85% from $104,090 to $194,020
    (194020, 0.0985),# 9.85% above $194,020
]

MINNESOTA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0535),    # 5.35% up to $46,630
    (46630, 0.068), # 6.8% from $46,630 to $184,020
    (184020, 0.0785),# 7.85% from $184,020 to $304,970
    (304970, 0.0985),# 9.85% above $304,970
]

MINNESOTA_STANDARD_DEDUCTION = {
    "Single": 14975,
    "Married Filing Jointly": 29950,
    "Married Filing Separately": 14975,
    "Head of Household": 22400,
}

# Mississippi (progressive, flat rate 4.7% for 2025)
MISSISSIPPI_TAX_BRACKETS = [
    (0, 0.047),     # 4.7% flat rate
]

MISSISSIPPI_STANDARD_DEDUCTION = {
    "Single": 2300,
    "Married Filing Jointly": 4600,
    "Married Filing Separately": 2300,
    "Head of Household": 3400,
}

# Missouri (progressive)
MISSOURI_TAX_BRACKETS_SINGLE = [
    (0, 0.0),       # 0% up to $1,121
    (1121, 0.02),   # 2% from $1,121 to $2,242
    (2242, 0.0225), # 2.25% from $2,242 to $3,363
    (3363, 0.025),  # 2.5% from $3,363 to $4,484
    (4484, 0.03),   # 3% from $4,484 to $5,605
    (5605, 0.0325), # 3.25% from $5,605 to $6,726
    (6726, 0.035),  # 3.5% from $6,726 to $7,847
    (7847, 0.0375), # 3.75% from $7,847 to $8,968
    (8968, 0.04),   # 4% from $8,968 to $9,000
    (9000, 0.045),  # 4.5% above $9,000
]

MISSOURI_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0),       # 0% up to $2,242
    (2242, 0.02),   # 2% from $2,242 to $4,484
    (4484, 0.0225), # 2.25% from $4,484 to $6,726
    (6726, 0.025),  # 2.5% from $6,726 to $8,968
    (8968, 0.03),   # 3% from $8,968 to $11,210
    (11210, 0.0325),# 3.25% from $11,210 to $13,452
    (13452, 0.035), # 3.5% from $13,452 to $15,694
    (15694, 0.0375),# 3.75% from $15,694 to $17,936
    (17936, 0.04),  # 4% from $17,936 to $18,000
    (18000, 0.045), # 4.5% above $18,000
]

MISSOURI_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Montana (progressive)
MONTANA_TAX_BRACKETS_SINGLE = [
    (0, 0.01),      # 1% up to $3,100
    (3100, 0.02),   # 2% from $3,100 to $5,500
    (5500, 0.03),   # 3% from $5,500 to $8,400
    (8400, 0.04),   # 4% from $8,400 to $11,300
    (11300, 0.05),  # 5% from $11,300 to $14,500
    (14500, 0.06),  # 6% above $14,500
]

MONTANA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.01),      # 1% up to $6,200
    (6200, 0.02),   # 2% from $6,200 to $11,000
    (11000, 0.03),  # 3% from $11,000 to $16,800
    (16800, 0.04),  # 4% from $16,800 to $22,600
    (22600, 0.05),  # 5% from $22,600 to $29,000
    (29000, 0.06),  # 6% above $29,000
]

MONTANA_STANDARD_DEDUCTION = {
    "Single": 5680,
    "Married Filing Jointly": 11360,
    "Married Filing Separately": 5680,
    "Head of Household": 11360,
}

# Nebraska (progressive)
NEBRASKA_TAX_BRACKETS_SINGLE = [
    (0, 0.0246),    # 2.46% up to $3,700
    (3700, 0.0351), # 3.51% from $3,700 to $22,170
    (22170, 0.0501),# 5.01% from $22,170 to $35,730
    (35730, 0.0684),# 6.84% above $35,730
]

NEBRASKA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0246),    # 2.46% up to $7,390
    (7390, 0.0351), # 3.51% from $7,390 to $44,350
    (44350, 0.0501),# 5.01% from $44,350 to $71,470
    (71470, 0.0684),# 6.84% above $71,470
]

NEBRASKA_STANDARD_DEDUCTION = {
    "Single": 7900,
    "Married Filing Jointly": 15790,
    "Married Filing Separately": 7895,
    "Head of Household": 11840,
}

# Nevada - No state income tax (handled in NO_INCOME_TAX_STATES)

# New Hampshire - Only taxes interest and dividends (handled in NO_INCOME_TAX_STATES)

# New Jersey (progressive)
NEW_JERSEY_TAX_BRACKETS_SINGLE = [
    (0, 0.014),     # 1.4% up to $20,000
    (20000, 0.0175),# 1.75% from $20,000 to $35,000
    (35000, 0.035), # 3.5% from $35,000 to $40,000
    (40000, 0.05525),# 5.525% from $40,000 to $75,000
    (75000, 0.0637),# 6.37% from $75,000 to $500,000
    (500000, 0.0897),# 8.97% from $500,000 to $1,000,000
    (1000000, 0.1075),# 10.75% above $1,000,000
]

NEW_JERSEY_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.014),     # 1.4% up to $20,000
    (20000, 0.0175),# 1.75% from $20,000 to $50,000
    (50000, 0.035), # 3.5% from $50,000 to $70,000
    (70000, 0.05525),# 5.525% from $70,000 to $80,000
    (80000, 0.0637),# 6.37% from $80,000 to $150,000
    (150000, 0.0897),# 8.97% from $150,000 to $500,000
    (500000, 0.1075),# 10.75% above $500,000
]

NEW_JERSEY_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# New Mexico (progressive)
NEW_MEXICO_TAX_BRACKETS_SINGLE = [
    (0, 0.017),     # 1.7% up to $5,500
    (5500, 0.032),  # 3.2% from $5,500 to $11,000
    (11000, 0.047), # 4.7% from $11,000 to $16,000
    (16000, 0.049), # 4.9% from $16,000 to $210,000
    (210000, 0.052),# 5.2% from $210,000 to $315,000
    (315000, 0.059),# 5.9% above $315,000
]

NEW_MEXICO_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.017),     # 1.7% up to $8,000
    (8000, 0.032),  # 3.2% from $8,000 to $16,000
    (16000, 0.047), # 4.7% from $16,000 to $24,000
    (24000, 0.049), # 4.9% from $24,000 to $315,000
    (315000, 0.052),# 5.2% from $315,000 to $470,000
    (470000, 0.059),# 5.9% above $470,000
]

NEW_MEXICO_STANDARD_DEDUCTION = {
    "Single": 14950,
    "Married Filing Jointly": 29900,
    "Married Filing Separately": 14950,
    "Head of Household": 22400,
}

# North Carolina (flat rate)
NORTH_CAROLINA_TAX_BRACKETS = [
    (0, 0.0475),    # 4.75% flat rate
]

NORTH_CAROLINA_STANDARD_DEDUCTION = {
    "Single": 12550,
    "Married Filing Jointly": 25100,
    "Married Filing Separately": 12550,
    "Head of Household": 18800,
}

# North Dakota (progressive)
NORTH_DAKOTA_TAX_BRACKETS_SINGLE = [
    (0, 0.0),       # 0% up to $44,725
    (44725, 0.015), # 1.5% from $44,725 to $225,975
    (225975, 0.025),# 2.5% from $225,975 to $458,350
    (458350, 0.029),# 2.9% from $458,350 to $500,000
    (500000, 0.031),# 3.1% above $500,000
]

NORTH_DAKOTA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0),       # 0% up to $89,450
    (89450, 0.015), # 1.5% from $89,450 to $190,750
    (190750, 0.025),# 2.5% from $190,750 to $364,200
    (364200, 0.029),# 2.9% from $364,200 to $445,850
    (445850, 0.031),# 3.1% above $445,850
]

NORTH_DAKOTA_STANDARD_DEDUCTION = {
    "Single": 14950,
    "Married Filing Jointly": 29900,
    "Married Filing Separately": 14950,
    "Head of Household": 22400,
}

# Ohio (progressive, flat rate 2.75% above threshold)
OHIO_TAX_BRACKETS = [
    (0, 0.0),       # 0% up to $26,050
    (26050, 0.0275),# 2.75% above $26,050
]

OHIO_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Oklahoma (progressive)
OKLAHOMA_TAX_BRACKETS_SINGLE = [
    (0, 0.0025),    # 0.25% up to $1,000
    (1000, 0.0075), # 0.75% from $1,000 to $2,500
    (2500, 0.0175), # 1.75% from $2,500 to $3,750
    (3750, 0.0275), # 2.75% from $3,750 to $4,900
    (4900, 0.0375), # 3.75% from $4,900 to $7,200
    (7200, 0.0475), # 4.75% above $7,200
]

OKLAHOMA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0025),    # 0.25% up to $2,000
    (2000, 0.0075), # 0.75% from $2,000 to $5,000
    (5000, 0.0175), # 1.75% from $5,000 to $7,500
    (7500, 0.0275), # 2.75% from $7,500 to $9,800
    (9800, 0.0375), # 3.75% from $9,800 to $12,200
    (12200, 0.0475),# 4.75% above $12,200
]

OKLAHOMA_STANDARD_DEDUCTION = {
    "Single": 6350,
    "Married Filing Jointly": 12700,
    "Married Filing Separately": 6350,
    "Head of Household": 9350,
}

# Oregon (progressive)
OREGON_TAX_BRACKETS_SINGLE = [
    (0, 0.0475),    # 4.75% up to $4,050
    (4050, 0.0675), # 6.75% from $4,050 to $10,200
    (10200, 0.0875),# 8.75% from $10,200 to $125,000
    (125000, 0.099),# 9.9% above $125,000
]

OREGON_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0475),    # 4.75% up to $8,100
    (8100, 0.0675), # 6.75% from $8,100 to $20,400
    (20400, 0.0875),# 8.75% from $20,400 to $250,000
    (250000, 0.099),# 9.9% above $250,000
]

OREGON_STANDARD_DEDUCTION = {
    "Single": 2518,
    "Married Filing Jointly": 5036,
    "Married Filing Separately": 2518,
    "Head of Household": 3777,
}

# Pennsylvania (flat rate)
PENNSYLVANIA_TAX_BRACKETS = [
    (0, 0.0307),    # 3.07% flat rate
]

PENNSYLVANIA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Rhode Island (progressive)
RHODE_ISLAND_TAX_BRACKETS_SINGLE = [
    (0, 0.0375),    # 3.75% up to $68,200
    (68200, 0.0475),# 4.75% from $68,200 to $155,050
    (155050, 0.0599),# 5.99% above $155,050
]

RHODE_ISLAND_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0375),    # 3.75% up to $68,200
    (68200, 0.0475),# 4.75% from $68,200 to $155,050
    (155050, 0.0599),# 5.99% above $155,050
]

RHODE_ISLAND_STANDARD_DEDUCTION = {
    "Single": 10000,
    "Married Filing Jointly": 20000,
    "Married Filing Separately": 10000,
    "Head of Household": 10000,
}

# South Carolina (progressive)
SOUTH_CAROLINA_TAX_BRACKETS_SINGLE = [
    (0, 0.0),       # 0% up to $3,200
    (3200, 0.03),   # 3% from $3,200 to $16,040
    (16040, 0.05),  # 5% from $16,040 to $80,200
    (80200, 0.06),  # 6% above $80,200
]

SOUTH_CAROLINA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0),       # 0% up to $3,200
    (3200, 0.03),   # 3% from $3,200 to $16,040
    (16040, 0.05),  # 5% from $16,040 to $80,200
    (80200, 0.06),  # 6% above $80,200
]

SOUTH_CAROLINA_STANDARD_DEDUCTION = {
    "Single": 13950,
    "Married Filing Jointly": 27900,
    "Married Filing Separately": 13950,
    "Head of Household": 13950,
}

# South Dakota - No state income tax (handled in NO_INCOME_TAX_STATES)

# Tennessee - Only taxes interest and dividends (handled in NO_INCOME_TAX_STATES)

# Texas - No state income tax (handled in NO_INCOME_TAX_STATES)

# Utah (flat rate)
UTAH_TAX_BRACKETS = [
    (0, 0.0445),    # 4.45% flat rate
]

UTAH_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Vermont (progressive)
VERMONT_TAX_BRACKETS_SINGLE = [
    (0, 0.0335),    # 3.35% up to $45,400
    (45400, 0.066), # 6.6% from $45,400 to $110,050
    (110050, 0.076),# 7.6% from $110,050 to $229,550
    (229550, 0.0875),# 8.75% above $229,550
]

VERMONT_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0335),    # 3.35% up to $90,800
    (90800, 0.066), # 6.6% from $90,800 to $220,100
    (220100, 0.076),# 7.6% from $220,100 to $459,100
    (459100, 0.0875),# 8.75% above $459,100
]

VERMONT_STANDARD_DEDUCTION = {
    "Single": 6500,
    "Married Filing Jointly": 13000,
    "Married Filing Separately": 6500,
    "Head of Household": 10000,
}

# Virginia (progressive)
VIRGINIA_TAX_BRACKETS_SINGLE = [
    (0, 0.02),      # 2% up to $3,000
    (3000, 0.03),   # 3% from $3,000 to $5,000
    (5000, 0.05),   # 5% from $5,000 to $17,000
    (17000, 0.0575),# 5.75% above $17,000
]

VIRGINIA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.02),      # 2% up to $3,000
    (3000, 0.03),   # 3% from $3,000 to $5,000
    (5000, 0.05),   # 5% from $5,000 to $17,000
    (17000, 0.0575),# 5.75% above $17,000
]

VIRGINIA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Washington - No state income tax (handled in NO_INCOME_TAX_STATES)

# West Virginia (progressive)
WEST_VIRGINIA_TAX_BRACKETS_SINGLE = [
    (0, 0.03),      # 3% up to $10,000
    (10000, 0.04),  # 4% from $10,000 to $25,000
    (25000, 0.045), # 4.5% from $25,000 to $40,000
    (40000, 0.06),  # 6% from $40,000 to $60,000
    (60000, 0.065), # 6.5% above $60,000
]

WEST_VIRGINIA_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.03),      # 3% up to $10,000
    (10000, 0.04),  # 4% from $10,000 to $25,000
    (25000, 0.045), # 4.5% from $25,000 to $40,000
    (40000, 0.06),  # 6% from $40,000 to $60,000
    (60000, 0.065), # 6.5% above $60,000
]

WEST_VIRGINIA_STANDARD_DEDUCTION = {
    "Single": 0,
    "Married Filing Jointly": 0,
    "Married Filing Separately": 0,
    "Head of Household": 0,
}

# Wisconsin (progressive)
WISCONSIN_TAX_BRACKETS_SINGLE = [
    (0, 0.0354),    # 3.54% up to $13,810
    (13810, 0.0465),# 4.65% from $13,810 to $27,630
    (27630, 0.053), # 5.3% from $27,630 to $304,170
    (304170, 0.0765),# 7.65% above $304,170
]

WISCONSIN_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0354),    # 3.54% up to $18,420
    (18420, 0.0465),# 4.65% from $18,420 to $36,840
    (36840, 0.053), # 5.3% from $36,840 to $405,550
    (405550, 0.0765),# 7.65% above $405,550
]

WISCONSIN_STANDARD_DEDUCTION = {
    "Single": 12220,
    "Married Filing Jointly": 24440,
    "Married Filing Separately": 12220,
    "Head of Household": 12220,
}

# Wyoming - No state income tax (handled in NO_INCOME_TAX_STATES)

# District of Columbia (progressive)
DC_TAX_BRACKETS_SINGLE = [
    (0, 0.04),      # 4% up to $10,000
    (10000, 0.06),  # 6% from $10,000 to $40,000
    (40000, 0.065), # 6.5% from $40,000 to $60,000
    (60000, 0.085), # 8.5% from $60,000 to $250,000
    (250000, 0.0925),# 9.25% from $250,000 to $500,000
    (500000, 0.0975),# 9.75% from $500,000 to $1,000,000
    (1000000, 0.1075),# 10.75% above $1,000,000
]

DC_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.04),      # 4% up to $10,000
    (10000, 0.06),  # 6% from $10,000 to $40,000
    (40000, 0.065), # 6.5% from $40,000 to $60,000
    (60000, 0.085), # 8.5% from $60,000 to $350,000
    (350000, 0.0925),# 9.25% from $350,000 to $1,000,000
    (1000000, 0.0975),# 9.75% from $1,000,000 to $1,500,000
    (1500000, 0.1075),# 10.75% above $1,500,000
]

DC_STANDARD_DEDUCTION = {
    "Single": 14950,
    "Married Filing Jointly": 29900,
    "Married Filing Separately": 14950,
    "Head of Household": 22400,
}

# States with no income tax
NO_INCOME_TAX_STATES = [
    "Texas", "TX",
    "Florida", "FL",
    "Nevada", "NV",
    "South Dakota", "SD",
    "Washington", "WA",
    "Wyoming", "WY",
    "Tennessee", "TN",  # Only taxes interest and dividends, not wages
    "New Hampshire", "NH",  # Only taxes interest and dividends, not wages
    "Alaska", "AK",  # No state income tax
]

# Helper function to normalize state name
def normalize_state_name(state: Optional[str]) -> Optional[str]:
    """Normalize state name to full name."""
    if not state:
        return None
    
    state_upper = state.upper().strip()
    
    # Map abbreviations to full names (all 50 states + DC)
    state_map = {
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "DC": "District of Columbia",
    }
    
    # Check if it's an abbreviation
    if state_upper in state_map:
        return state_map[state_upper]
    
    # Check if it matches a full name (case-insensitive)
    for abbrev, full_name in state_map.items():
        if state_upper == full_name.upper():
            return full_name
    
    # Return original if not found
    return state


def get_tax_brackets(filing_status: str) -> List[Tuple[float, float]]:
    """Get tax brackets based on filing status."""
    status_map = {
        "Single": TAX_BRACKETS_SINGLE,
        "Married Filing Jointly": TAX_BRACKETS_MARRIED_JOINTLY,
        "Married Filing Separately": TAX_BRACKETS_MARRIED_SEPARATELY,
        "Head of Household": TAX_BRACKETS_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": TAX_BRACKETS_MARRIED_JOINTLY,  # Uses same brackets as Married Filing Jointly
    }
    return status_map.get(filing_status, TAX_BRACKETS_SINGLE)


def get_qualified_dividend_brackets(filing_status: str) -> List[Tuple[float, float]]:
    """Get qualified dividend tax brackets based on filing status."""
    status_map = {
        "Single": QUALIFIED_DIVIDEND_BRACKETS_SINGLE,
        "Married Filing Jointly": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY,
        "Married Filing Separately": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_SEPARATELY,
        "Head of Household": QUALIFIED_DIVIDEND_BRACKETS_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY,  # Uses same brackets as Married Filing Jointly
    }
    return status_map.get(filing_status, QUALIFIED_DIVIDEND_BRACKETS_SINGLE)


def get_standard_deduction(filing_status: str, person1_age: int = 0, person2_age: int = 0) -> float:
    """Calculate standard deduction based on filing status and age."""
    base_deductions = {
        "Single": STANDARD_DEDUCTION_SINGLE,
        "Married Filing Jointly": STANDARD_DEDUCTION_MARRIED_JOINTLY,
        "Married Filing Separately": STANDARD_DEDUCTION_MARRIED_SEPARATELY,
        "Head of Household": STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": STANDARD_DEDUCTION_MARRIED_JOINTLY,  # Uses same deduction as Married Filing Jointly
    }
    
    base = base_deductions.get(filing_status, STANDARD_DEDUCTION_SINGLE)
    
    # Add age-based deductions
    additional = 0
    if filing_status == "Married Filing Jointly" or filing_status == "Qualifying Surviving Spouse":
        if person1_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
        if person2_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
    elif filing_status in ["Single", "Married Filing Separately", "Head of Household"]:
        if person1_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
    
    return base + additional


def get_state_tax_brackets(state: str, filing_status: str) -> Optional[List[Tuple[float, float]]]:
    """Get state tax brackets based on state and filing status."""
    normalized_state = normalize_state_name(state)
    
    if not normalized_state:
        return None
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        return None
    
    # States with same brackets for all filing statuses
    flat_bracket_states = {
        "California": CALIFORNIA_TAX_BRACKETS,
        "Georgia": GEORGIA_TAX_BRACKETS,
        "Arizona": ARIZONA_TAX_BRACKETS,
        "Alabama": ALABAMA_TAX_BRACKETS,
        "Arkansas": ARKANSAS_TAX_BRACKETS,
        "Colorado": COLORADO_TAX_BRACKETS,
        "Delaware": DELAWARE_TAX_BRACKETS,
        "Idaho": IDAHO_TAX_BRACKETS,
        "Illinois": ILLINOIS_TAX_BRACKETS,
        "Indiana": INDIANA_TAX_BRACKETS,
        "Iowa": IOWA_TAX_BRACKETS,
        "Kentucky": KENTUCKY_TAX_BRACKETS,
        "Massachusetts": MASSACHUSETTS_TAX_BRACKETS,
        "Michigan": MICHIGAN_TAX_BRACKETS,
        "Mississippi": MISSISSIPPI_TAX_BRACKETS,
        "North Carolina": NORTH_CAROLINA_TAX_BRACKETS,
        "Ohio": OHIO_TAX_BRACKETS,
        "Pennsylvania": PENNSYLVANIA_TAX_BRACKETS,
        "Utah": UTAH_TAX_BRACKETS,
    }
    
    if normalized_state in flat_bracket_states:
        return flat_bracket_states[normalized_state]
    
    # States with different brackets by filing status
    if normalized_state == "New York":
        return NEW_YORK_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else NEW_YORK_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Connecticut":
        return CONNECTICUT_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else CONNECTICUT_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Hawaii":
        return HAWAII_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else HAWAII_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Kansas":
        return KANSAS_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else KANSAS_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Louisiana":
        return LOUISIANA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else LOUISIANA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Maine":
        return MAINE_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else MAINE_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Maryland":
        return MARYLAND_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else MARYLAND_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Minnesota":
        return MINNESOTA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else MINNESOTA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Missouri":
        return MISSOURI_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else MISSOURI_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Montana":
        return MONTANA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else MONTANA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Nebraska":
        return NEBRASKA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else NEBRASKA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "New Jersey":
        return NEW_JERSEY_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else NEW_JERSEY_TAX_BRACKETS_SINGLE
    
    if normalized_state == "New Mexico":
        return NEW_MEXICO_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else NEW_MEXICO_TAX_BRACKETS_SINGLE
    
    if normalized_state == "North Dakota":
        return NORTH_DAKOTA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else NORTH_DAKOTA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Oklahoma":
        return OKLAHOMA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else OKLAHOMA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Oregon":
        return OREGON_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else OREGON_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Rhode Island":
        return RHODE_ISLAND_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else RHODE_ISLAND_TAX_BRACKETS_SINGLE
    
    if normalized_state == "South Carolina":
        return SOUTH_CAROLINA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else SOUTH_CAROLINA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Vermont":
        return VERMONT_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else VERMONT_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Virginia":
        return VIRGINIA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else VIRGINIA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "West Virginia":
        return WEST_VIRGINIA_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else WEST_VIRGINIA_TAX_BRACKETS_SINGLE
    
    if normalized_state == "Wisconsin":
        return WISCONSIN_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else WISCONSIN_TAX_BRACKETS_SINGLE
    
    if normalized_state == "District of Columbia":
        return DC_TAX_BRACKETS_MARRIED_JOINTLY if filing_status == "Married Filing Jointly" else DC_TAX_BRACKETS_SINGLE
    
    return None


def get_state_standard_deduction(state: str, filing_status: str) -> float:
    """Get state standard deduction based on state and filing status."""
    normalized_state = normalize_state_name(state)
    
    if not normalized_state:
        return 0.0
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        return 0.0
    
    # States with standard deductions
    state_deductions = {
        "Alabama": ALABAMA_STANDARD_DEDUCTION,
        "Arizona": ARIZONA_STANDARD_DEDUCTION,
        "Arkansas": ARKANSAS_STANDARD_DEDUCTION,
        "California": CALIFORNIA_STANDARD_DEDUCTION,
        "Colorado": COLORADO_STANDARD_DEDUCTION,
        "Connecticut": CONNECTICUT_STANDARD_DEDUCTION,
        "Delaware": DELAWARE_STANDARD_DEDUCTION,
        "Georgia": GEORGIA_STANDARD_DEDUCTION,
        "Hawaii": HAWAII_STANDARD_DEDUCTION,
        "Idaho": IDAHO_STANDARD_DEDUCTION,
        "Illinois": ILLINOIS_STANDARD_DEDUCTION,
        "Indiana": INDIANA_STANDARD_DEDUCTION,
        "Iowa": IOWA_STANDARD_DEDUCTION,
        "Kansas": KANSAS_STANDARD_DEDUCTION,
        "Kentucky": KENTUCKY_STANDARD_DEDUCTION,
        "Louisiana": LOUISIANA_STANDARD_DEDUCTION,
        "Maine": MAINE_STANDARD_DEDUCTION,
        "Maryland": MARYLAND_STANDARD_DEDUCTION,
        "Massachusetts": MASSACHUSETTS_STANDARD_DEDUCTION,
        "Michigan": MICHIGAN_STANDARD_DEDUCTION,
        "Minnesota": MINNESOTA_STANDARD_DEDUCTION,
        "Mississippi": MISSISSIPPI_STANDARD_DEDUCTION,
        "Missouri": MISSOURI_STANDARD_DEDUCTION,
        "Montana": MONTANA_STANDARD_DEDUCTION,
        "Nebraska": NEBRASKA_STANDARD_DEDUCTION,
        "New Jersey": NEW_JERSEY_STANDARD_DEDUCTION,
        "New Mexico": NEW_MEXICO_STANDARD_DEDUCTION,
        "New York": NEW_YORK_STANDARD_DEDUCTION,
        "North Carolina": NORTH_CAROLINA_STANDARD_DEDUCTION,
        "North Dakota": NORTH_DAKOTA_STANDARD_DEDUCTION,
        "Ohio": OHIO_STANDARD_DEDUCTION,
        "Oklahoma": OKLAHOMA_STANDARD_DEDUCTION,
        "Oregon": OREGON_STANDARD_DEDUCTION,
        "Pennsylvania": PENNSYLVANIA_STANDARD_DEDUCTION,
        "Rhode Island": RHODE_ISLAND_STANDARD_DEDUCTION,
        "South Carolina": SOUTH_CAROLINA_STANDARD_DEDUCTION,
        "Utah": UTAH_STANDARD_DEDUCTION,
        "Vermont": VERMONT_STANDARD_DEDUCTION,
        "Virginia": VIRGINIA_STANDARD_DEDUCTION,
        "West Virginia": WEST_VIRGINIA_STANDARD_DEDUCTION,
        "Wisconsin": WISCONSIN_STANDARD_DEDUCTION,
        "District of Columbia": DC_STANDARD_DEDUCTION,
    }
    
    if normalized_state in state_deductions:
        return state_deductions[normalized_state].get(filing_status, 0.0)
    
    return 0.0


def calculate_age_from_birthdate(birthdate: str, current_year: int = None) -> int:
    """Calculate age from birthdate string (YYYY-MM-DD format)."""
    if not birthdate:
        return 0
    
    try:
        birth_year = int(birthdate.split('-')[0])
        if current_year is None:
            current_year = datetime.now().year
        return current_year - birth_year
    except (ValueError, IndexError, AttributeError):
        return 0


def calculate_tax(
    taxable_income: float,
    filing_status: str,
    person1_birthdate: str = None,
    person2_birthdate: str = None,
    current_year: int = None,
) -> float:
    """
    Calculate federal income tax using progressive brackets.
    
    Args:
        taxable_income: Total taxable income (after deductions)
        filing_status: Tax filing status
        person1_birthdate: Birthdate of person 1 (YYYY-MM-DD format)
        person2_birthdate: Birthdate of person 2 (YYYY-MM-DD format, optional)
        current_year: Current year for age calculation (defaults to current year)
    
    Returns:
        Total federal income tax owed
    """
    import sys
    print(f"--- DEBUG calculate_tax: taxable_income={taxable_income}, filing_status={filing_status}, current_year={current_year} ---"); sys.stdout.flush()
    
    if taxable_income <= 0:
        print(f"--- DEBUG calculate_tax: Returning 0.0 because taxable_income <= 0 ---"); sys.stdout.flush()
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    
    # Get standard deduction (note: this is calculated but not used, as taxable_income already has deductions applied)
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    
    # Taxable income for calculation (should be after standard deduction)
    income_to_tax = max(0, taxable_income)  # Ensure non-negative
    
    # Get appropriate tax brackets
    brackets = get_tax_brackets(filing_status)
    print(f"--- DEBUG calculate_tax: income_to_tax={income_to_tax}, brackets={brackets} ---"); sys.stdout.flush()
    
    # Calculate tax using progressive brackets
    tax = 0.0
    previous_bracket = 0
    
    for i, (bracket_threshold, rate) in enumerate(brackets):
        if income_to_tax > previous_bracket:
            # Calculate amount in this bracket
            if i < len(brackets) - 1:
                # Not the last bracket
                next_threshold = brackets[i + 1][0]
                amount_in_bracket = min(income_to_tax, next_threshold) - previous_bracket
            else:
                # Last bracket (top bracket)
                amount_in_bracket = income_to_tax - previous_bracket
            
            print(f"--- DEBUG calculate_tax: Bracket {i}: threshold={bracket_threshold}, rate={rate}, previous_bracket={previous_bracket}, amount_in_bracket={amount_in_bracket} ---"); sys.stdout.flush()
            
            if amount_in_bracket > 0:
                bracket_tax = amount_in_bracket * rate
                tax += bracket_tax
                print(f"--- DEBUG calculate_tax: Bracket {i}: bracket_tax={bracket_tax}, cumulative_tax={tax} ---"); sys.stdout.flush()
                previous_bracket = brackets[i + 1][0] if i < len(brackets) - 1 else income_to_tax
        else:
            print(f"--- DEBUG calculate_tax: Breaking at bracket {i} because income_to_tax <= previous_bracket ---"); sys.stdout.flush()
            break
    
    final_tax = round(tax, 2)
    print(f"--- DEBUG calculate_tax: Final tax={final_tax} ---"); sys.stdout.flush()
    return final_tax


def calculate_state_tax(
    taxable_income: float,
    state: str,
    filing_status: str,
    current_year: int = None,
) -> float:
    """
    Calculate state income tax using progressive brackets.
    
    Args:
        taxable_income: Total taxable income (after federal deductions, typically after state deductions too)
        state: State of residence (full name or abbreviation)
        filing_status: Tax filing status
        current_year: Current year (for future use if rates change by year)
    
    Returns:
        Total state income tax owed (0.0 if state has no income tax)
    """
    import sys
    print(f"--- DEBUG calculate_state_tax: taxable_income={taxable_income}, state={state}, filing_status={filing_status}, current_year={current_year} ---"); sys.stdout.flush()
    
    if taxable_income <= 0:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because taxable_income <= 0 ---"); sys.stdout.flush()
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    normalized_state = normalize_state_name(state)
    if not normalized_state:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because state is invalid/empty ---"); sys.stdout.flush()
        return 0.0
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because {normalized_state} has no income tax ---"); sys.stdout.flush()
        return 0.0
    
    # Get state tax brackets
    brackets = get_state_tax_brackets(normalized_state, filing_status)
    if not brackets:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because no brackets found for {normalized_state} ---"); sys.stdout.flush()
        return 0.0
    
    # California: For Married Filing Jointly, divide income by 2 (community property state)
    income_to_tax = taxable_income
    if normalized_state == "California" and filing_status == "Married Filing Jointly":
        income_to_tax = taxable_income / 2.0
        print(f"--- DEBUG calculate_state_tax: California MFJ - dividing income by 2: {taxable_income} -> {income_to_tax} ---"); sys.stdout.flush()
    
    income_to_tax = max(0, income_to_tax)  # Ensure non-negative
    print(f"--- DEBUG calculate_state_tax: income_to_tax={income_to_tax}, brackets={brackets} ---"); sys.stdout.flush()
    
    # Calculate tax using progressive brackets
    tax = 0.0
    previous_bracket = 0
    
    for i, (bracket_threshold, rate) in enumerate(brackets):
        if income_to_tax > previous_bracket:
            # Calculate amount in this bracket
            if i < len(brackets) - 1:
                # Not the last bracket
                next_threshold = brackets[i + 1][0]
                amount_in_bracket = min(income_to_tax, next_threshold) - previous_bracket
            else:
                # Last bracket (top bracket)
                amount_in_bracket = income_to_tax - previous_bracket
            
            print(f"--- DEBUG calculate_state_tax: Bracket {i}: threshold={bracket_threshold}, rate={rate}, previous_bracket={previous_bracket}, amount_in_bracket={amount_in_bracket} ---"); sys.stdout.flush()
            
            if amount_in_bracket > 0:
                bracket_tax = amount_in_bracket * rate
                tax += bracket_tax
                print(f"--- DEBUG calculate_state_tax: Bracket {i}: bracket_tax={bracket_tax}, cumulative_tax={tax} ---"); sys.stdout.flush()
                previous_bracket = brackets[i + 1][0] if i < len(brackets) - 1 else income_to_tax
        else:
            print(f"--- DEBUG calculate_state_tax: Breaking at bracket {i} because income_to_tax <= previous_bracket ---"); sys.stdout.flush()
            break
    
    # California: Multiply by 2 for MFJ (since we divided by 2 earlier)
    if normalized_state == "California" and filing_status == "Married Filing Jointly":
        tax = tax * 2.0
        print(f"--- DEBUG calculate_state_tax: California MFJ - multiplying tax by 2: {tax} ---"); sys.stdout.flush()
    
    final_tax = round(tax, 2)
    print(f"--- DEBUG calculate_state_tax: Final tax={final_tax} ---"); sys.stdout.flush()
    return final_tax


def calculate_qualified_dividend_tax(
    qualified_dividend_amount: float,
    total_taxable_income: float,
    filing_status: str,
    current_year: int = None,
) -> float:
    """
    Calculate tax on qualified dividends using capital gains rates.
    
    Qualified dividends are taxed at special rates (0%, 15%, 20%) based on the taxpayer's
    total taxable income. All qualified dividends are taxed at the same rate, which is
    determined by the taxpayer's total taxable income level.
    
    Args:
        qualified_dividend_amount: Amount of qualified dividends
        total_taxable_income: Total taxable income (ordinary income + qualified dividends, after deductions)
        filing_status: Tax filing status
        current_year: Current year (for consistency, though rates don't change mid-year)
    
    Returns:
        Tax owed on qualified dividends
    """
    if qualified_dividend_amount <= 0:
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Get qualified dividend brackets
    qd_brackets = get_qualified_dividend_brackets(filing_status)
    
    # Determine the rate based on total taxable income
    # All qualified dividends are taxed at the same rate, based on total taxable income
    rate = 0.0
    for i, (threshold, bracket_rate) in enumerate(qd_brackets):
        if i < len(qd_brackets) - 1:
            next_threshold = qd_brackets[i + 1][0]
            if total_taxable_income >= threshold and total_taxable_income < next_threshold:
                rate = bracket_rate
                break
        else:
            # Last bracket (top bracket)
            if total_taxable_income >= threshold:
                rate = bracket_rate
                break
    
    # Apply the rate to all qualified dividends
    tax = qualified_dividend_amount * rate
    
    return round(tax, 2)


def calculate_taxable_income(
    total_income: float,
    tax_deductible_expenses: float = 0.0,
    filing_status: str = "Single",
    person1_birthdate: str = None,
    person2_birthdate: str = None,
    current_year: int = None,
    qualified_dividends: float = 0.0,
) -> Tuple[float, float, float]:
    """
    Calculate taxable income and tax.
    
    Args:
        total_income: Total taxable income (sum of all income items with taxable=True, including qualified dividends)
        tax_deductible_expenses: Total tax-deductible expenses (sum of expenses with tax_deductible=True)
        filing_status: Tax filing status
        person1_birthdate: Birthdate of person 1 (YYYY-MM-DD format)
        person2_birthdate: Birthdate of person 2 (YYYY-MM-DD format, optional)
        current_year: Current year for age calculation
        qualified_dividends: Amount of qualified dividends (subset of total_income, taxed at capital gains rates)
    
    Returns:
        Tuple of (taxable_income, standard_deduction, tax_owed)
    """
    import sys
    print(f"--- DEBUG calculate_taxable_income: total_income={total_income}, tax_deductible_expenses={tax_deductible_expenses}, filing_status={filing_status}, current_year={current_year}, qualified_dividends={qualified_dividends} ---"); sys.stdout.flush()
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    print(f"--- DEBUG calculate_taxable_income: person1_age={person1_age}, person2_age={person2_age} ---"); sys.stdout.flush()
    
    # Get standard deduction
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    print(f"--- DEBUG calculate_taxable_income: standard_deduction={standard_deduction} ---"); sys.stdout.flush()
    
    # Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
    agi = max(0, total_income - tax_deductible_expenses)
    print(f"--- DEBUG calculate_taxable_income: agi={agi} ---"); sys.stdout.flush()
    
    # Taxable income = AGI - standard deduction
    taxable_income = max(0, agi - standard_deduction)
    print(f"--- DEBUG calculate_taxable_income: taxable_income={taxable_income} ---"); sys.stdout.flush()
    
    # Separate ordinary income and qualified dividends
    # Note: qualified_dividends is already included in total_income, so we subtract it to get ordinary income
    ordinary_income = max(0, taxable_income - qualified_dividends)
    qualified_dividend_income = min(qualified_dividends, taxable_income)
    print(f"--- DEBUG calculate_taxable_income: ordinary_income={ordinary_income}, qualified_dividend_income={qualified_dividend_income} ---"); sys.stdout.flush()
    
    # Calculate tax on ordinary income
    print(f"--- DEBUG calculate_taxable_income: Calling calculate_tax with ordinary_income={ordinary_income} ---"); sys.stdout.flush()
    ordinary_tax = calculate_tax(ordinary_income, filing_status, person1_birthdate, person2_birthdate, current_year)
    print(f"--- DEBUG calculate_taxable_income: ordinary_tax={ordinary_tax} ---"); sys.stdout.flush()
    
    # Calculate tax on qualified dividends (if any)
    qualified_tax = 0.0
    if qualified_dividend_income > 0:
        qualified_tax = calculate_qualified_dividend_tax(
            qualified_dividend_income,
            taxable_income,
            filing_status,
            current_year
        )
        print(f"--- DEBUG calculate_taxable_income: qualified_tax={qualified_tax} ---"); sys.stdout.flush()
    
    # Total tax = tax on ordinary income + tax on qualified dividends
    tax_owed = ordinary_tax + qualified_tax
    print(f"--- DEBUG calculate_taxable_income: Final tax_owed={tax_owed} (ordinary_tax={ordinary_tax} + qualified_tax={qualified_tax}) ---"); sys.stdout.flush()
    
    return (taxable_income, standard_deduction, tax_owed)


def calculate_state_taxable_income(
    total_income: float,
    tax_deductible_expenses: float = 0.0,
    state: str = None,
    filing_status: str = "Single",
    federal_tax_owed: float = 0.0,
    current_year: int = None,
) -> Tuple[float, float, float]:
    """
    Calculate state taxable income and state tax.
    
    Note: State taxes are typically based on federal AGI (with state-specific adjustments),
    but some states allow deducting federal tax paid. For simplicity, we'll use federal taxable income
    as the starting point, with state-specific standard deductions.
    
    Args:
        total_income: Total taxable income (sum of all income items with taxable=True)
        tax_deductible_expenses: Total tax-deductible expenses (sum of expenses with tax_deductible=True)
        state: State of residence (full name or abbreviation)
        filing_status: Tax filing status
        federal_tax_owed: Federal tax owed (some states allow deducting this)
        current_year: Current year for calculation
    
    Returns:
        Tuple of (state_taxable_income, state_standard_deduction, state_tax_owed)
    """
    import sys
    print(f"--- DEBUG calculate_state_taxable_income: total_income={total_income}, tax_deductible_expenses={tax_deductible_expenses}, state={state}, filing_status={filing_status}, federal_tax_owed={federal_tax_owed}, current_year={current_year} ---"); sys.stdout.flush()
    
    if current_year is None:
        current_year = datetime.now().year
    
    normalized_state = normalize_state_name(state)
    if not normalized_state:
        print(f"--- DEBUG calculate_state_taxable_income: Returning zeros because state is invalid/empty ---"); sys.stdout.flush()
        return (0.0, 0.0, 0.0)
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        print(f"--- DEBUG calculate_state_taxable_income: Returning zeros because {normalized_state} has no income tax ---"); sys.stdout.flush()
        return (0.0, 0.0, 0.0)
    
    # Get state standard deduction
    state_standard_deduction = get_state_standard_deduction(normalized_state, filing_status)
    print(f"--- DEBUG calculate_state_taxable_income: state_standard_deduction={state_standard_deduction} ---"); sys.stdout.flush()
    
    # Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
    agi = max(0, total_income - tax_deductible_expenses)
    print(f"--- DEBUG calculate_state_taxable_income: agi={agi} ---"); sys.stdout.flush()
    
    # State taxable income = AGI - state standard deduction
    # Note: Some states allow deducting federal tax, but we'll keep it simple for now
    state_taxable_income = max(0, agi - state_standard_deduction)
    print(f"--- DEBUG calculate_state_taxable_income: state_taxable_income={state_taxable_income} ---"); sys.stdout.flush()
    
    # Calculate state tax
    state_tax_owed = calculate_state_tax(
        state_taxable_income,
        normalized_state,
        filing_status,
        current_year
    )
    print(f"--- DEBUG calculate_state_taxable_income: Final state_tax_owed={state_tax_owed} ---"); sys.stdout.flush()
    
    return (state_taxable_income, state_standard_deduction, state_tax_owed)

import pytest
from api.utils.rmd import calculate_rmd

def test_calculate_rmd_uniform():
    # Owner born 1950-01-01 -> age 76 in 2026; uniform divisor for 76 is 22.0
    owner_bd = "1950-01-01"
    balance = 22000.0
    res = calculate_rmd(owner_bd, balance, 2026, None)
    assert res["year"] == 2026
    assert abs(res["divisor"] - 22.0) < 0.001
    assert abs(res["rmd_amount"] - (balance / 22.0)) < 0.01
    assert res["table_used"] == "uniform"

def test_calculate_rmd_joint():
    # Example from public sources: owner 76 (born 1950), spouse 60 (born 1966) -> joint divisor ~28.2
    owner_bd = "1950-01-01"
    spouse_bd = "1966-01-01"
    balance = 262000.0
    res = calculate_rmd(owner_bd, balance, 2026, spouse_bd)
    assert res["year"] == 2026
    # Expected divisor ~28.2 from public table example
    assert abs(res["divisor"] - 28.2) < 0.1
    assert abs(res["rmd_amount"] - (balance / res["divisor"])) < 0.5
    assert res["table_used"] in ("joint", "uniform")


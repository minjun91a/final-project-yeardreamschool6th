"""Read the versioned corporate catalog without modifying the source data."""
import hashlib
import os
import posixpath
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from threading import Lock
from typing import Annotated, Literal
from urllib.parse import quote
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query

from scripts.load_search_data import read_jsonl

CatalogType = Literal["prescription", "herb", "efficacy"]
SOURCE_FILE = "(스마트제조) 메디케이시스템 - 약재 추천 데이터.xlsx"
SHEET = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
FIELDS = {
    "prescription": ("PRESP_UNIQN", "PRESP_NM", "PRESP_CONT"),
    "herb": ("MED_UNIQN", "MED_NM", "MED_APR_CONT"),
    "efficacy": ("EFF_UNIQN", "EFF_NM", "EFF_CONT"),
    "disease": ("DIS_UNIQN", "ATT_DIS_NM", "ATT_DIS_CONT"),
}
load_lock = Lock()


def clean(value):
    return value if isinstance(value, str) and value.strip() else None


def workbook_rows(archive, path, shared, sheet_name, version):
    headers = {}
    with archive.open(path) as sheet:
        for _, row in ElementTree.iterparse(sheet, events=("end",)):
            if row.tag != SHEET + "row":
                continue
            number = int(row.attrib["r"])
            record, cells = {}, {}
            for cell in row:
                address = cell.attrib["r"]
                column = re.match(r"[A-Z]+", address).group()
                kind = cell.get("t")
                value = cell.findtext(SHEET + "v")
                if kind == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(SHEET + "t"))
                elif kind == "s":
                    value = shared[int(value)]
                if number == 1:
                    headers[column] = value
                elif column in headers and value is not None:
                    key = headers[column]
                    record[key] = int(value) if key.endswith("_UNIQN") else value
                    cells[key] = address
            row.clear()
            if record:
                record["source"] = {"file": SOURCE_FILE, "file_sha256": version,
                                    "sheet": sheet_name, "row": number, "cells": cells}
                yield record


def read_workbook(path, version):
    names = ("EFF", "ATT_DIS", "MED_EFF_RSHIP", "MED_ATT_DIS_RSHIP", "ATT_DIS_PRESP_RSHIP")
    with path.open("rb") as file:
        digest = hashlib.sha256()
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
        if digest.hexdigest() != version:
            raise ValueError("기업 원본과 조회 자료의 버전이 일치하지 않습니다.")
        file.seek(0)
        with ZipFile(file) as archive:
            catalog = ElementTree.fromstring(archive.read("xl/workbook.xml"))
            relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            paths = {rel.get("Id"): rel.get("Target") for rel in relationships}
            sheets = {node.get("name"): paths[node.get(REL_ID)] for node in catalog.iter(SHEET + "sheet")}
            shared = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
                shared = ["".join(node.text or "" for node in item.iter(SHEET + "t")) for item in strings]
            return {name: list(workbook_rows(
                archive, sheets[name].lstrip("/") if sheets[name].startswith("/") else
                posixpath.normpath(posixpath.join("xl", sheets[name])), shared, name, version,
            )) for name in names}


@lru_cache(maxsize=1)
def load_catalog(directory, workbook):
    prescriptions = read_jsonl(directory / "처방전체원문.jsonl")
    herbs = read_jsonl(directory / "약재전체원문.jsonl")
    compositions = read_jsonl(directory / "처방약재구성전체.jsonl")
    version = prescriptions[0]["source"]["file_sha256"]
    if any(row["source"]["file_sha256"] != version for row in prescriptions + herbs + compositions):
        raise ValueError("기업 조회 자료의 원본 버전이 일치하지 않습니다.")
    sheets = read_workbook(workbook, version)
    tables = {kind: {row[FIELDS[kind][0]]: row for row in rows} for kind, rows in (
        ("prescription", prescriptions), ("herb", herbs),
        ("efficacy", sheets["EFF"]), ("disease", sheets["ATT_DIS"]),
    )}
    relations = defaultdict(set)
    for left, right, rows in (
        ("prescription", "herb", compositions), ("prescription", "disease", sheets["ATT_DIS_PRESP_RSHIP"]),
        ("herb", "efficacy", sheets["MED_EFF_RSHIP"]), ("herb", "disease", sheets["MED_ATT_DIS_RSHIP"]),
    ):
        for row in rows:
            left_id, right_id = row[FIELDS[left][0]], row[FIELDS[right][0]]
            if left_id in tables[left] and right_id in tables[right]:
                relations[left, left_id, right].add(right_id)
                relations[right, right_id, left].add(left_id)
    ingredients = defaultdict(list)
    for row in compositions:
        herb = tables["herb"].get(row["MED_UNIQN"])
        if herb is None:
            continue
        amount = clean(row["UNT_COEFF"])
        ingredients[row["PRESP_UNIQN"]].append({
            "compositionId": row["RSHIP_UNIQN"], "id": row["MED_UNIQN"], "name": herb["MED_NM"],
            "amount": amount if amount and re.fullmatch(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)", amount) else None,
            "unit": clean(row["UNT"]), "preparation": clean(row["MED_SPEC_REP"]),
            "originalDoseInfo": clean(row["CC_INFO"]),
        })
    return tables, relations, ingredients


def corporate_data():
    directory = Path(os.getenv(
        "KM_CDSS_CATALOG_ROOT", str(Path(__file__).resolve().parents[1] / "data/prescription_catalog"),
    ))
    workbook = Path(os.getenv("KM_CDSS_CATALOG_WORKBOOK", str(Path.home() / "Desktop" / SOURCE_FILE)))
    try:
        with load_lock:
            return load_catalog(directory, workbook)
    except (OSError, ValueError, KeyError, IndexError, TypeError, BadZipFile, ElementTree.ParseError) as error:
        raise HTTPException(503, "기업 조회 원본과 자료 버전을 확인할 수 없습니다.") from error


def item_for(kind, row):
    id_key, name_key, _ = FIELDS[kind]
    return {"id": row[id_key], "name": row[name_key]}


def sources_for(kind, record):
    id_key, name_key, description = FIELDS[kind]
    source = record["source"]
    version = source["file_sha256"]
    item_id = record[id_key]
    for column in (description, "DISP_USG_CONT", "TABO_CONT"):
        original, cell = clean(record.get(column)), source["cells"].get(column)
        if original and cell:
            source_id = f"{source['sheet']}-{item_id}-{column}-{version}"
            yield {
                "sourceId": source_id, "sourceTitle": record[name_key], "dataVersion": f"sha256:{version}",
                "sourceUrl": f"/api/catalog/{kind}/{item_id}/sources/{quote(source_id, safe='')}",
                "fileName": source["file"], "sheet": source["sheet"], "column": column,
                "sourceLocation": f"{source['sheet']}!{cell}", "itemId": item_id, "row": source["row"],
                "excerpt": original, "originalText": original,
            }


def catalog_record(tables, kind, item_id):
    record = tables[kind].get(item_id)
    if record is None:
        raise HTTPException(404, "기업 자료 항목을 찾을 수 없습니다.")
    return record


def create_catalog_router(require_clinical_user):
    router = APIRouter(prefix="/api/catalog")
    ItemId = Annotated[int, Query(gt=0, le=2**31 - 1)]

    @router.get("/search")
    def search(type: CatalogType, query: str, account=Depends(require_clinical_user)):
        term = query.strip()
        if not term:
            return {"items": [], "total": 0, "message": None}
        tables, _, _ = corporate_data()
        name_field = FIELDS[type][1]
        items = sorted((item_for(type, row) for row in tables[type].values()
                        if term in row[name_field]), key=lambda row: (row["name"], row["id"]))
        return {"items": items, "total": len(items), "message": None}

    @router.get("/{type}/{itemId}")
    def detail(type: CatalogType, itemId: int, selectedDiseaseId: ItemId | None = None,
               account=Depends(require_clinical_user)):
        if itemId <= 0 or (selectedDiseaseId is not None and type != "prescription"):
            raise HTTPException(400, "기업 항목 조회 조건을 확인해주세요.")
        tables, links, ingredients = corporate_data()
        row = catalog_record(tables, type, itemId)
        description, caution = clean(row.get(FIELDS[type][2])), clean(row.get("TABO_CONT"))
        relations = {
            plural: sorted((item_for(kind, tables[kind][target])
                            for target in links.get((type, itemId, kind), ())),
                           key=lambda item: (item["name"], item["id"]))
            for plural, kind in (("diseases", "disease"), ("prescriptions", "prescription"),
                                 ("herbs", "herb"), ("efficacies", "efficacy"))
        }
        record = {
            **item_for(type, row), "type": type, "description": description,
            "evidence": [{key: value for key, value in source.items() if key != "originalText"}
                         for source in sources_for(type, row)],
            "registeredCautionTexts": [caution] if caution else [], "relations": relations,
            "messages": [message for value, message in (
                (description, "등록된 설명 없음"), (caution, "등록된 주의정보 없음"),
            ) if value is None],
        }
        if type == "prescription":
            record.update(usageText=clean(row.get("DISP_USG_CONT")), ingredients=ingredients.get(itemId, []),
                          connectedToSelectedDisease=selectedDiseaseId in links.get((type, itemId, "disease"), ())
                          if selectedDiseaseId is not None else None)
        return {"record": record}

    @router.get("/{type}/{itemId}/sources/{sourceId}")
    def source(type: CatalogType, itemId: int, sourceId: str, account=Depends(require_clinical_user)):
        tables, _, _ = corporate_data()
        for evidence in sources_for(type, catalog_record(tables, type, itemId)):
            if evidence["sourceId"] == sourceId:
                return {"record": evidence}
        raise HTTPException(404, "기업 원문을 찾을 수 없습니다.")

    return router

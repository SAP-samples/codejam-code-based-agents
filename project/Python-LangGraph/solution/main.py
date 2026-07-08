from investigator_graph import investigator_graph
from payload import payload


def main():
    result = investigator_graph.invoke({
        "payload": payload,
        "suspect_names": "Sophie Dubois, Marcus Chen, Viktor Petrov",
        "appraisal_result": None,
        "evidence_analysis": None,
        "intelligence_report": None,
        "final_conclusion": None,
        "messages": [],
    })

    print("\n" + "="*50)
    print("Appraisal Result:")
    print("="*50)
    print(result["appraisal_result"] or "(not set)")

    print("\n" + "="*50)
    print("Evidence Analysis:")
    print("="*50)
    print(result["evidence_analysis"] or "(not set)")

    print("\n" + "="*50)
    print("Intelligence Report:")
    print("="*50)
    print(result["intelligence_report"] or "(not set)")

    print("\n" + "="*50)
    print("Investigation Report:")
    print("="*50)
    print(result["final_conclusion"] or "Investigation completed but no conclusion was reached.")


if __name__ == "__main__":
    main()

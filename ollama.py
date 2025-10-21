from openai import OpenAI

client = OpenAI(base_url="https://neuronews-ai.tou.edu.kz/v1", api_key="not-needed")

response = client.chat.completions.create(
    model="gemma3:12b",
    messages=[
        {"role": "system", "content": "Ты журналист в сфере технологий."},
        {"role": "user", "content": "Создай краткое описание проекта NeuroNews."}
    ]
)

print(response.choices[0].message.content)

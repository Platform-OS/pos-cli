#!/usr/bin/env python3
\"\"\"MCP Client Example - Python
Demonstrates MCP server interaction with requests library
$ pip install requests
\"\"\"
import requests
import json
import sys

BASE_URL = 'http://localhost:3030'
TOKEN = 'client-secret'  # from clients.json

def main():
    print('🤖 MCP Python Client\\n')
    
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # 1. List tools
    print('1. Listing tools...')
    r = requests.get(f'{BASE_URL}/tools', headers=headers)
    r.raise_for_status()
    tools = r.json()
    print(f'Available: {len(tools[\"tools\"])} tools')
    for tool in tools['tools']:
        print(f'  • {tool[\"name\"]} - {tool[\"description\"][:50]}...')
    
    # 2. List environments
    print('\\n2. Listing environments...')
    r = requests.post(f'{BASE_URL}/call', 
                     headers=headers,
                     json={'tool': 'platformos.env.list', 'input': {}})
    r.raise_for_status()
    data = r.json()
    envs = json.loads(data['content'][0]['text'])
    env_names = [e['name'] for e in envs.get('envs', [])]
    print(f'Envs: {\", \".join(env_names) or \"None\"}')
    
    # 3. Liquid render demo
    print('\\n3. Liquid render demo...')
    r = requests.post(f'{BASE_URL}/call',
                     headers=headers,
                     json={
                         'tool': 'platformos.liquid.render',
                         'input': {
                             'env': 'staging' if 'staging' in env_names else env_names[0] if env_names else None,
                             'template': 'Hello {{name}}! Today is {{ \"now\" | date: \"%Y-%m-%d\" }}',
                             'locals': {'name': 'Python MCP Client'}
                         }
                     })
    if r.status_code == 200:
        data = r.json()
        result = json.loads(data['content'][0]['text'])
        print('Output:', result['output'])
    else:
        print('Error:', r.text)
    
    # 4. Health check (admin)
    print('\\n4. Server health (ADMIN_API_KEY required)...')
    r = requests.get(f'{BASE_URL}/health', headers={'x-api-key': 'your-admin-key'})
    if r.status_code == 200:
        health = r.json()
        print(f'Status: {health[\"status\"]}, Tools: {health[\"toolCount\"]}')
    else:
        print('Admin check failed (expected without ADMIN_API_KEY)')
    
    print('\\n✅ Demo complete! 🎉')

if __name__ == '__main__':
    main()
","path":"examples/python-client.py
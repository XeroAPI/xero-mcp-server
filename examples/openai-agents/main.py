import asyncio
import os
import shutil
from agents import Agent, Runner, gen_trace_id, trace
from agents.mcp import MCPServer, MCPServerStdio

async def run(mcp_server: MCPServer):
    agent = Agent(
        name="Assistant",
        model="gpt-4o-mini",
        instructions="You are a helpful assistant with access to xero",
        mcp_servers=[mcp_server]
    )

    # Get message from user input
    message = input("Enter your message for Xero (e.g., 'List my contacts in Xero'): ")
    print(f"Running: {message}")
    result = await Runner.run(starting_agent=agent, input=message)
    print(result.final_output)

async def main():      
    async with MCPServerStdio(
        name="Xero",
        params={
            "command": "npx",
            "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
            "env": {
                "XERO_CLIENT_ID": os.environ['XERO_CLIENT_ID'],
                "XERO_CLIENT_SECRET": os.environ['XERO_CLIENT_SECRET']
            }
        }
    ) as server:
        trace_id = gen_trace_id()
        with trace(workflow_name="Xero MCP Example", trace_id=trace_id):
            print(f"View trace: https://platform.openai.com/traces/{trace_id}\n")
            await run(server)

if __name__ == "__main__":
    # Let's make sure the user has npx installed
    if not shutil.which("npx"):
        raise RuntimeError("npx is not installed. Please install it with `npm install -g npx`.")

    asyncio.run(main())
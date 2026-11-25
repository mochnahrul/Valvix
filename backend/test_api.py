import asyncio
import json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


async def run_tests():
    print("1. Initializing database schema...")
    await init_db()
    print("Database tables initialized successfully.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("\n2. Testing /health endpoint...")
        res = await client.get("/health")
        assert res.status_code == 200
        print(f"Health response [{res.status_code}]:", res.json())

        print("\n3. Testing /api/sync/rabscuttle endpoint...")
        res_sync = await client.post("/api/sync/rabscuttle")
        assert res_sync.status_code == 200
        data = res_sync.json()
        steam_id = data['profile']['steamId64']
        print(f"Profile: {data['profile']['personaName']} (SteamID64: {steam_id})")
        print(f"Total Games Synced: {len(data['games'])}")
        print(f"Total Playtime Hours: {data['overview']['totalPlaytimeHours']}h")

        print(f"\n4. Testing GET /api/users/{steam_id}/overview...")
        res_overview = await client.get(f"/api/users/{steam_id}/overview")
        assert res_overview.status_code == 200
        overview = res_overview.json()
        print(f"Overview Total Games: {overview['totalGames']}, Unplayed: {overview['unplayedCount']}")

        print(f"\n5. Testing GET /api/users/{steam_id}/games...")
        res_games = await client.get(f"/api/users/{steam_id}/games")
        assert res_games.status_code == 200
        games = res_games.json()
        print(f"Games count: {len(games)}")

        print("\n6. Testing Co-op Squad Matcher: POST /api/coop/intersect...")
        squad_payload = {
            "steamIds": [steam_id, "kaelen_prime"],  # Testing vanity resolution
            "filterTag": "coop_only"
        }
        res_squad = await client.post("/api/coop/intersect", json=squad_payload)
        assert res_squad.status_code == 200
        squad_data = res_squad.json()
        print(f"Squad Members: {len(squad_data['members'])}")
        print(f"Shared Co-op Games Count: {squad_data['totalSharedGames']}")
        assert squad_data['totalSharedGames'] > 0
        for g in squad_data['intersectedGames'][:3]:
            print(f" - {g['name']} (AppID: {g['appId']}, Co-op: {g['isCoop']})")

        print("\n7. Testing Achievement Tracker: GET /api/games/1086940/achievements/{steam_id}...")
        res_ach = await client.get(f"/api/games/1086940/achievements/{steam_id}")
        assert res_ach.status_code == 200
        achievements = res_ach.json()
        print(f"Fetched {len(achievements)} achievements for Baldur's Gate 3.")
        first_ach = achievements[0]
        print(f"Sample Achievement: '{first_ach['name']}' (Unlocked: {first_ach['unlocked']}, Rarity: {first_ach.get('rarityPercent')}%)")

        print("\n8. Testing AI Achievement Unlock Guide: POST /api/achievements/guide...")
        guide_req = {
            "appId": 1086940,
            "achievementApiName": "bg3_2",
            "name": "Leave No One Behind",
            "description": "Save all the Tiefling refugees throughout the entire game in a single playthrough."
        }
        res_guide = await client.post("/api/achievements/guide", json=guide_req)
        assert res_guide.status_code == 200
        guide_data = res_guide.json()
        print(f"Guide Difficulty: {guide_data['difficulty']}")
        print(f"Guide Summary: {guide_data['summary']}")
        print(f"Steps: {len(guide_data['steps'])} steps generated.")

        # Test cache hit on second call
        res_guide_cached = await client.post("/api/achievements/guide", json=guide_req)
        assert res_guide_cached.status_code == 200
        assert res_guide_cached.json()['summary'] == guide_data['summary']
        print("Verified DB cache hit for achievement guide.")

        print("\n9. Testing AI Gaming Persona & Roast: POST /api/users/{steam_id}/persona...")
        for tone in ["playful", "friendly", "brutal"]:
            persona_req = {"tone": tone, "forceRefresh": False}
            res_persona = await client.post(f"/api/users/{steam_id}/persona", json=persona_req)
            assert res_persona.status_code == 200
            p_data = res_persona.json()
            print(f"\n--- Tone: [{tone.upper()}] ---")
            print(f"Archetype: {p_data['archetypeTitle']}")
            print(f"Telemetry Hash: {p_data['telemetryHash'][:16]}...")
            print(f"Roast: {p_data['comedyRoast']}")
            print(f"Dominant Genres: {[g['genre'] for g in p_data['dominantGenres'][:2]]}")
            assert len(p_data['strengths']) >= 3
            assert p_data['telemetrySnapshot']['totalGames'] > 0

    print("\nALL PHASE 2 BACKEND ENDPOINTS AND LOGIC VERIFIED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(run_tests())

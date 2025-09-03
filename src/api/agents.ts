import { FastifyInstance } from 'fastify'
import { generateAgentKeyPair } from '../services/4runr-cipher'
import { memoryDB } from '../models/memory-db'
import { recordAgentCreation } from '../observability/metrics'

interface CreateAgentBody {
  name: string
  created_by: string
  role: string
}

export async function agentRoutes(server: FastifyInstance) {
  server.post('/create-agent', async (request, reply) => {
    try {
      const { name, created_by, role } = request.body as CreateAgentBody

      console.log('Incoming request to create agent:', { name, created_by, role });
      if (!name || !created_by || !role) {
        console.error('Missing required fields for agent creation:', { name, created_by, role });
        return reply.code(400).send({ 
          error: 'Missing required fields: name, created_by, and role are required.' 
        })
      }

      const { publicKey, privateKey } = generateAgentKeyPair()

      const agent = await memoryDB.createAgent({
        name,
        createdBy: created_by,
        role,
        publicKey,
        status: 'active'
      })

      recordAgentCreation(agent.id)
      console.log('Agent created successfully:', { agent_id: agent.id });
      return reply.code(201).send({
        agent_id: agent.id,
        private_key: privateKey
      })

    } catch (error) {
      console.error('Error creating agent:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while creating agent.' 
      })
    }
  })

  server.get('/agents', async (request, reply) => {
    try {
      const agents = await memoryDB.getAllAgents()

      return reply.send({ agents })

    } catch (error) {
      console.error('Error fetching agents:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while fetching agents.' 
      })
    }
  })

  server.get('/agents/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const agent = await memoryDB.findAgentById(id)

      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found.' })
      }

      return reply.send({ agent })

    } catch (error) {
      console.error('Error fetching agent:', error)
      return reply.code(500).send({ 
        error: 'Internal server error while fetching agent.' 
      })
    }
  })
}



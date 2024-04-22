def name = 'pos-cli'

pipeline {
  agent any

  environment {
    MPKIT_TOKEN = credentials('MPKIT_TOKEN')
    MPKIT_EMAIL = "darek+ci@near-me.com"
    MPKIT_URL = "https://qa-17263.staging.oregon.platform-os.com"
    POS_PORTAL_PASSWORD = credentials('POS_PORTAL_PASSWORD')
  }

  stages {
    stage('Test 16-alpine') {
      agent { kubernetes { yaml podTemplate("amd64", "16-alpine") } }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'chown -R node:node * && chown node:node . && su -c "npm ci && npm test" node'
        }
      }
    }

    stage('Test 18-alpine') {
      agent { kubernetes { yaml podTemplate("amd64", "18-alpine") } }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'chown -R node:node * && chown node:node . && su -c "npm ci && npm test" node'
        }
      }
    }

    stage('Test 20-alpine') {
      agent { kubernetes { yaml podTemplate("amd64", "20-alpine") } }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'chown -R node:node * && chown node:node . && su -c "npm ci && npm test" node'
        }
      }
    }

    stage('Test latest package 20-alpine') {
      agent { kubernetes { yaml podTemplate("amd64", "20-alpine") } }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'npm install -g @platformos/pos-cli'
          sh 'pos-cli env list'
        }
      }
    }
  }
}

def podTemplate(arch,version) {
  return """
        spec:
          nodeSelector:
            beta.kubernetes.io/arch: "${arch}"
          containers:
          - name: node
            resources:
              limits:
                memory: 1Gi
              requests:
                cpu: 1
              memory: 1Gi
            image: 'node:${version}'
            imagePullPolicy: IfNotPresent
            command:
            - cat
            tty: true
"""
}

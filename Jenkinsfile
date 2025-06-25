def name = 'pos-cli'

pipeline {
  agent any

  options {
    disableConcurrentBuilds()
  }

  environment {
    MPKIT_TOKEN = credentials('MPKIT_TOKEN')
    MPKIT_EMAIL = "darek+ci@near-me.com"
    MPKIT_URL = "https://qa-17263.staging.oregon.platform-os.com"
    POS_PORTAL_PASSWORD = credentials('POS_PORTAL_PASSWORD')
    CI = 'true'
  }

  stages {
    stage('Test 18') {
      agent { kubernetes { yaml podTemplate("18") } }
      options { timeout(time: 500, unit: 'SECONDS') }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'chown -R node:node * && chown node:node . && su -c "npm ci && npm test" node'
        }
      }
    }

    stage('Test 20') {
      agent { kubernetes { yaml podTemplate("20") } }
      options { timeout(time: 500, unit: 'SECONDS') }

      steps {
        container(name: 'node') {
          sh 'set -e'
          sh 'chown -R node:node * && chown node:node . && su -c "npm ci && npm test" node'
        }
      }
    }

    stage('Test tagged release') {
      agent { kubernetes { yaml podTemplate("20.11") } }
      // when { tag pattern: "v.*", comparator: "REGEXP"}

      steps {
        container(name: 'node') {
          sh 'npm install -g @platformos/pos-cli'
          echo $date
          // sh 'pos-cli init'
          // sh 'pos-cli data clean --auto-confirm --include-schema'
          // sh 'pos-cli deploy'
        }
      }
    }
  }
}

def podTemplate(version) {
  return """
        spec:
          nodeSelector:
            beta.kubernetes.io/arch: amd64
          containers:
          - name: node
            resources:
              limits:
                cpu: 2
                memory: 2Gi
              requests:
                cpu: 2
              memory: 2Gi
            image: 'node:${version}-alpine'
            imagePullPolicy: IfNotPresent
            command:
            - cat
            tty: true
"""
}

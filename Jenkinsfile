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
    stage('Test') {
      agent { kubernetes { yaml podTemplate("amd64") } }

      steps {
        container(name: 'node') {
          sh 'sleep 1d'
          sh 'set -e'
          sh 'npm ci'
          sh 'npm test'
        }
      }
    }
  }
}

def podTemplate(arch) {
  return """
        spec:
          nodeSelector:
            beta.kubernetes.io/arch: "${arch}"
          containers:
          - name: node
            resources:
              limits:
                cpu: 2
                memory: 2Gi
              requests:
                cpu: 2
              memory: 2Gi
            image: 'node:16-alpine'
            imagePullPolicy: IfNotPresent
            command:
            - cat
            tty: true
"""
}
